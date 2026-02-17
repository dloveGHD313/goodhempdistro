import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getPostLoginRoute, type PostLoginProfile } from "@/lib/routing/postLoginRoute";
import {
  getDefaultRouteForUser,
  isSafeNextPath,
  isValidWorkoutPath,
} from "@/lib/phase2-workout-flow";

/**
 * Single source of truth for post-auth redirect. Onboarding gating always wins.
 * GET: no params, returns redirect from profile only (back-compat).
 * POST: body { next?, workoutPath?, role? } — onboarding required → /onboarding; else safe next, else workout default, else post-login.
 */
async function getRedirect(
  profile: PostLoginProfile,
  next: string | null | undefined,
  workoutPathParam: string | null | undefined,
  profileWorkoutPath?: string | null
): Promise<string> {
  const mandatory = getPostLoginRoute(profile);
  if (mandatory === "/onboarding") {
    return "/onboarding";
  }
  if (isSafeNextPath(next)) {
    return next;
  }
  const path = profileWorkoutPath ?? workoutPathParam ?? undefined;
  if (isValidWorkoutPath(path)) {
    return getDefaultRouteForUser({
      accountRole: profile?.role ?? null,
      workoutPath: path,
    });
  }
  return mandatory;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ redirectTo: "/onboarding" as const });
  }

  const { data } = await supabase
    .from("profiles")
    .select("role, onboarding_completed_at, consumer_onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const profile: PostLoginProfile = data
    ? {
        role: data.role ?? null,
        onboarding_completed_at: data.onboarding_completed_at ?? null,
        consumer_onboarding_completed: data.consumer_onboarding_completed ?? null,
      }
    : null;

  const redirectTo = getPostLoginRoute(profile);
  return NextResponse.json({ redirectTo });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ redirectTo: "/onboarding" as const });
  }

  let next: string | null | undefined;
  let workoutPathParam: string | null | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { next?: string; workoutPath?: string; role?: string };
    next = typeof body.next === "string" ? body.next.trim() || null : null;
    workoutPathParam =
      typeof body.workoutPath === "string" ? body.workoutPath.trim() || null
      : typeof body.role === "string" ? body.role.trim() || null
      : null;
  } catch {
    next = null;
    workoutPathParam = null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("role, onboarding_completed_at, consumer_onboarding_completed, workout_path")
    .eq("id", user.id)
    .maybeSingle();

  const profile: PostLoginProfile = data
    ? {
        role: data.role ?? null,
        onboarding_completed_at: data.onboarding_completed_at ?? null,
        consumer_onboarding_completed: data.consumer_onboarding_completed ?? null,
      }
    : null;

  const profileWorkoutPath = data?.workout_path ?? null;
  const redirectTo = await getRedirect(profile, next, workoutPathParam, profileWorkoutPath);
  return NextResponse.json({ redirectTo });
}
