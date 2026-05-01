import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { ALLOWED_ROLES, hasRole } from "@/lib/roles";
import { getConsumerUseType, isConsumerWholesaleChoice } from "@/lib/onboarding/answers";
import { isValidOnboardingState } from "@/lib/onboarding/us-states";
import { deriveProfileFieldsFromUser } from "@/lib/profile-utils";

type Payload = {
  version?: string;
  role?: string;
  roles?: string[];
  answers?: Record<string, string | string[]>;
  driver_mode?: string;
  onboarding_state?: string;
};

/** Onboarding request may only send these roles (subset of ALLOWED_ROLES; no admin). Payload cannot grant admin. */
const ONBOARDING_ROLES = ALLOWED_ROLES.filter((r) => r !== "admin");

function isAllowedOnboardingRole(r: string): boolean {
  return (ONBOARDING_ROLES as readonly string[]).includes(r);
}

/** Normalize to lowercase and dedupe, never return empty. */
function normalizeRolesList(roles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of roles) {
    const n = String(r).trim().toLowerCase();
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out.length > 0 ? out : ["consumer"];
}

/**
 * Phase 1.5: Persist questionnaire answers and set onboarding_completed_at.
 * Admin is never accepted from payload; existing admin is preserved so submit cannot revoke admin access.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_BODY" }, { status: 400 });
  }

  // Drop "admin" from payload if present; onboarding cannot grant admin.
  const rawRoles = Array.isArray(body?.roles) ? body.roles : typeof body?.role === "string" ? [body.role] : [];
  if (rawRoles.some((r) => String(r).toLowerCase() === "admin")) {
    console.warn("[onboarding/submit] Payload contained admin role; dropping. Cannot grant admin via onboarding.");
  }
  const baseRoles = normalizeRolesList(
    rawRoles.filter((r): r is string => typeof r === "string" && isAllowedOnboardingRole(r.trim().toLowerCase()))
  );
  const role = baseRoles[0] ?? "consumer";
  const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};
  const driver_mode = typeof body?.driver_mode === "string" ? body.driver_mode : undefined;
  const onboardingState = isValidOnboardingState(body?.onboarding_state) ? body.onboarding_state : null;

  const payload = {
    version: typeof body?.version === "string" ? body.version : "1.5",
    role,
    answers,
    driver_mode: driver_mode ?? null,
    updated_at: new Date().toISOString(),
  };

  const now = new Date().toISOString();

  const { data: existingProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("id, role, roles, market_mode_preference")
    .eq("id", user.id)
    .maybeSingle();

  if (profileReadError) {
    return NextResponse.json(
      { ok: false, error: profileReadError.message },
      { status: 500 }
    );
  }

  const existingAdmin = existingProfile ? hasRole(existingProfile, "admin") : false;
  let rolesToWrite =
    existingAdmin
      ? normalizeRolesList(["admin", ...baseRoles])
      : baseRoles;
  // Consumer + Business/Wholesale selection → add wholesale role (prefixed or unprefixed answer key)
  const useType = getConsumerUseType(answers);
  if (
    isConsumerWholesaleChoice(useType) &&
    rolesToWrite.includes("consumer") &&
    !rolesToWrite.includes("wholesale")
  ) {
    rolesToWrite = normalizeRolesList([...rolesToWrite, "wholesale"]);
  }

  if (existingProfile?.id) {
    const updatePayload: Record<string, unknown> = {
      onboarding_answers: payload,
      onboarding_completed_at: now,
      updated_at: now,
      roles: rolesToWrite,
    };
    if (onboardingState) updatePayload.onboarding_state = onboardingState;

    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
  } else {
    const { email, displayName, username } = deriveProfileFieldsFromUser(user);

    const insertPayload: Record<string, unknown> = {
      id: user.id,
      email,
      role: "consumer",
      roles: rolesToWrite,
      display_name: displayName,
      username,
      onboarding_answers: payload,
      onboarding_completed_at: now,
      updated_at: now,
      market_mode_preference: "CBD_WELLNESS",
    };
    if (onboardingState) insertPayload.onboarding_state = onboardingState;

    const { error } = await supabase.from("profiles").insert(insertPayload);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, role });
}
