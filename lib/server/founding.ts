import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  FOUNDING_CAP,
  FOUNDING_COOKIE,
  decodeFoundingCookie,
  type FoundingInterval,
  type FoundingKind,
  type FoundingStatus,
} from "@/lib/founding";

export type FoundingRow = {
  user_id: string;
  status: FoundingStatus;
  founding_number: number | null;
  kind: FoundingKind | null;
  source: string | null;
  plan_key: string | null;
  billing_interval: FoundingInterval | null;
  stripe_checkout_session_id: string | null;
  stripe_subscription_id: string | null;
  trial_end: string | null;
  claimed_at: string;
  checkout_started_at: string | null;
  activated_at: string | null;
};

const ROW_SELECT =
  "user_id, status, founding_number, kind, source, plan_key, billing_interval, stripe_checkout_session_id, stripe_subscription_id, trial_end, claimed_at, checkout_started_at, activated_at";

type Fail = { ok: false; reason: "full" | "already_active" | "error"; message: string };

function fail(err: { message?: string } | null | undefined): Fail {
  const m = err?.message ?? "";
  if (/founding_full/.test(m)) return { ok: false, reason: "full", message: `All ${FOUNDING_CAP} founding spots are taken.` };
  if (/founding_already_active/.test(m)) return { ok: false, reason: "already_active", message: "You are already a founding member." };
  console.error("[founding]", m);
  return { ok: false, reason: "error", message: "Something went wrong on our side. Please try again." };
}

/** Record a funnel visit as a pending founding row (no number yet). Idempotent. Never throws. */
export async function claimFoundingSpot(
  userId: string,
  opts: { kind?: FoundingKind | null; source?: string | null } = {}
): Promise<{ ok: true; already: boolean } | Fail> {
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("claim_founding_spot", {
      p_user: userId,
      p_source: opts.source ?? null,
      p_kind: opts.kind ?? null,
    });
    if (error) return fail(error);
    const row = Array.isArray(data) ? data[0] : data;
    return { ok: true, already: !!row?.already };
  } catch (err) {
    return fail(err as Error);
  }
}

/** Hold a spot for the open Stripe Checkout session (2 h). Returns spots remaining after the hold. */
export async function startFoundingCheckout(params: {
  userId: string;
  sessionId: string;
  planKey: string;
  interval: FoundingInterval;
  source?: string | null;
}): Promise<{ ok: true; remaining: number } | Fail> {
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("start_founding_checkout", {
      p_user: params.userId,
      p_session_id: params.sessionId,
      p_plan_key: params.planKey,
      p_interval: params.interval,
      p_source: params.source ?? null,
    });
    if (error) return fail(error);
    return { ok: true, remaining: typeof data === "number" ? data : Number(data ?? 0) };
  } catch (err) {
    return fail(err as Error);
  }
}

/** Stripe confirmed the checkout → assign the founding number. Idempotent. */
export async function activateFoundingSpot(params: {
  userId: string;
  sessionId: string | null;
  subscriptionId: string | null;
  planKey: string | null;
  interval: FoundingInterval | null;
  trialEnd: string | null;
}): Promise<{ ok: true; foundingNumber: number; already: boolean } | Fail> {
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("activate_founding_spot", {
      p_user: params.userId,
      p_session_id: params.sessionId,
      p_subscription_id: params.subscriptionId,
      p_plan_key: params.planKey,
      p_interval: params.interval,
      p_trial_end: params.trialEnd,
    });
    if (error) return fail(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.founding_number) return fail({ message: "activation returned no number" });
    return { ok: true, foundingNumber: row.founding_number, already: !!row.already };
  } catch (err) {
    return fail(err as Error);
  }
}

/** The user's founding row (pending or active), or null. Never throws. */
export async function getFoundingRow(userId: string | null | undefined): Promise<FoundingRow | null> {
  if (!userId) return null;
  try {
    const admin = getSupabaseAdminClient();
    const { data } = await admin.from("founding_members").select(ROW_SELECT).eq("user_id", userId).maybeSingle();
    return (data as FoundingRow | null) ?? null;
  } catch {
    return null;
  }
}

/** Confirmed founding member (number assigned) — used for badges. */
export async function getFoundingClaim(userId: string | null | undefined): Promise<FoundingRow | null> {
  const row = await getFoundingRow(userId);
  return row && row.status === "active" && row.founding_number != null ? row : null;
}

export async function isFoundingMember(userId: string | null | undefined): Promise<boolean> {
  return (await getFoundingClaim(userId)) !== null;
}

export type FoundingStats = { cap: number; claimed: number; remaining: number };

/** Public counter for the landing page. Never throws (falls back to all-open). */
export async function getFoundingStats(): Promise<FoundingStats> {
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("founding_spots_remaining");
    if (error) throw error;
    const remaining = Math.min(FOUNDING_CAP, Math.max(0, typeof data === "number" ? data : Number(data ?? FOUNDING_CAP)));
    return { cap: FOUNDING_CAP, claimed: FOUNDING_CAP - remaining, remaining };
  } catch {
    return { cap: FOUNDING_CAP, claimed: 0, remaining: FOUNDING_CAP };
  }
}

type CookieWriter = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): unknown;
};

/**
 * Redeem the funnel cookie on the first authenticated hop after sign-up / sign-in:
 * records a pending founding row (with the ?ref= source) so onboarding gating can
 * never lose the visit. Clears the cookie either way. Never throws.
 */
export async function redeemFoundingCookie(userId: string, cookieStore: CookieWriter): Promise<void> {
  const pending = decodeFoundingCookie(cookieStore.get(FOUNDING_COOKIE)?.value);
  if (!pending) return;
  await claimFoundingSpot(userId, pending);
  try {
    cookieStore.set(FOUNDING_COOKIE, "", { path: "/", maxAge: 0 });
  } catch {
    // cookie mutation is not allowed in every context; the claim itself is idempotent
  }
}

export type FoundingAdminRow = FoundingRow & {
  email: string | null;
  display_name: string | null;
  vendor_business_name: string | null;
  vendor_status: string | null;
  subscription_status: string | null;
};

/** Admin roster: every founding row (active first, by number), with vendor + subscription state. */
export async function listFoundingMembers(): Promise<FoundingAdminRow[]> {
  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("founding_members")
    .select(ROW_SELECT)
    .order("founding_number", { ascending: true, nullsFirst: false })
    .order("claimed_at", { ascending: true });
  if (error || !rows?.length) return [];
  const ids = rows.map((r) => r.user_id);
  const [profiles, vendors] = await Promise.all([
    admin.from("profiles").select("id, email, display_name").in("id", ids),
    admin.from("vendors").select("owner_user_id, business_name, status, subscription_status").in("owner_user_id", ids),
  ]);
  const pById = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const vById = new Map((vendors.data ?? []).map((v) => [v.owner_user_id, v]));
  return (rows as FoundingRow[]).map((r) => {
    const p = pById.get(r.user_id);
    const v = vById.get(r.user_id);
    return {
      ...r,
      email: p?.email ?? null,
      display_name: p?.display_name ?? null,
      vendor_business_name: v?.business_name ?? null,
      vendor_status: v?.status ?? null,
      subscription_status: v?.subscription_status ?? null,
    };
  });
}
