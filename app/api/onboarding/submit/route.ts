import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

type Payload = {
  version?: string;
  role?: string;
  answers?: Record<string, string>;
  driver_mode?: string;
};

const VALID_ROLES = ["vendor", "consumer", "driver", "affiliate", "industrial"];

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

  const role = typeof body?.role === "string" && VALID_ROLES.includes(body.role)
    ? body.role
    : "consumer";
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

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        onboarding_answers: payload,
        onboarding_completed_at: now,
        updated_at: now,
      },
      { onConflict: "id" }
    );

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, role });
}
