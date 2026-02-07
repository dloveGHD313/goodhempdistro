import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Persist welcome intents from localStorage to profile.
 * Called client-side after signup/login when WelcomeProfile exists.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { intents?: string[] };
  try {
    body = (await req.json()) as { intents?: string[] };
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_BODY" }, { status: 400 });
  }

  const intents = Array.isArray(body?.intents)
    ? body.intents.filter((x): x is string => typeof x === "string")
    : [];

  const { error } = await supabase
    .from("profiles")
    .update({
      welcome_intents: intents,
      welcome_intents_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { ok: false, code: "PERSIST_FAILED", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
