import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { ALLOWED_ROLES } from "@/lib/roles";

type Payload = {
  version?: string;
  role?: string;
  roles?: string[];
  answers?: Record<string, string | string[]>;
  driver_mode?: string;
};

/** Onboarding request may only send these roles (subset of ALLOWED_ROLES; no admin). */
const ONBOARDING_ROLES = ALLOWED_ROLES.filter((r) => r !== "admin");

function isAllowedOnboardingRole(r: string): boolean {
  return (ONBOARDING_ROLES as readonly string[]).includes(r);
}

/**
 * Phase 1.5: Persist questionnaire answers and set onboarding_completed_at.
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

  const role = typeof body?.role === "string" && isAllowedOnboardingRole(body.role)
    ? body.role
    : "consumer";
  const rolesArray = Array.isArray(body?.roles)
    ? body.roles.filter((r): r is string => typeof r === "string" && isAllowedOnboardingRole(r))
    : [role];
  const roles = rolesArray.length > 0 ? rolesArray : [role];
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
    .select("id, market_mode_preference")
    .eq("id", user.id)
    .maybeSingle();

  if (profileReadError) {
    return NextResponse.json(
      { ok: false, error: profileReadError.message },
      { status: 500 }
    );
  }

  if (existingProfile?.id) {
    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_answers: payload,
        onboarding_completed_at: now,
        updated_at: now,
        roles,
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
      roles,
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
