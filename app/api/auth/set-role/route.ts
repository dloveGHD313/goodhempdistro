import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { WORKOUT_REDIRECTS, type WorkoutPath } from "@/lib/phase2-workout-flow";

const VALID_ROLES = new Set<string>(Object.keys(WORKOUT_REDIRECTS));

/**
 * POST: Set profile.role for the current user (workout path only).
 * Used after signup when ?role= was passed from Start flow.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { role?: string };
  const role = typeof body.role === "string" ? body.role.trim() : null;

  if (!role || !VALID_ROLES.has(role)) {
    return NextResponse.json({ ok: false, code: "INVALID_ROLE" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: role as WorkoutPath, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, code: "UPDATE_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
