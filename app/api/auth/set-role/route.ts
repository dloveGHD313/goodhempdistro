import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isValidWorkoutPath, type WorkoutPath } from "@/lib/phase2-workout-flow";

/**
 * POST: Set profile.workout_path for the current user (Start flow selection).
 * Body: { workoutPath } or { role } (back-compat; role treated as workoutPath).
 * Does NOT update profiles.role (account type remains consumer/admin).
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { role?: string; workoutPath?: string };
  const raw = typeof body.workoutPath === "string" ? body.workoutPath : typeof body.role === "string" ? body.role : null;
  const workoutPath = typeof raw === "string" ? raw.trim() : null;

  if (!workoutPath || !isValidWorkoutPath(workoutPath)) {
    return NextResponse.json({ ok: false, code: "INVALID_ROLE" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        workout_path: workoutPath as WorkoutPath,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("id, workout_path")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, code: "UPDATE_FAILED", message: error.message }, { status: 500 });
  }

  if (data == null || data.workout_path !== workoutPath) {
    return NextResponse.json(
      { ok: false, code: "ROLE_NOT_PERSISTED", message: "Role was not persisted" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, workoutPath: data.workout_path });
}
