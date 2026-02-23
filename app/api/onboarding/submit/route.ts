import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { ALLOWED_ROLES, hasRole } from "@/lib/roles";

type Payload = {
  version?: string;
  role?: string;
  roles?: string[];
  answers?: Record<string, string | string[]>;
  driver_mode?: string;
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
  const rolesToWrite =
    existingAdmin
      ? normalizeRolesList(["admin", ...baseRoles])
      : baseRoles;

  if (existingProfile?.id) {
    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_answers: payload,
        onboarding_completed_at: now,
        updated_at: now,
        roles: rolesToWrite,
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
  } else {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      role: "consumer",
      roles: rolesToWrite,
      onboarding_answers: payload,
      onboarding_completed_at: now,
      updated_at: now,
      market_mode_preference: "CBD_WELLNESS",
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, role });
}
