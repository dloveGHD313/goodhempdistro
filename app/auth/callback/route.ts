import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPostLoginRoute, type PostLoginProfile } from "@/lib/routing/postLoginRoute";
import { getDefaultRouteForUser, isSafeNextPath, isValidWorkoutPath, type WorkoutPath } from "@/lib/phase2-workout-flow";

/**
 * Handle Supabase auth callback
 * Exchanges code for session and redirects to reset password page
 */
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    // Exchange code for session server-side
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie setting errors in middleware
            }
          },
        },
      }
    );

    // Exchange code for session
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] Error exchanging code:", error);
      // Check if this is a recovery flow - redirect to reset-password with error
      const type = requestUrl.searchParams.get("type");
      if (type === "recovery") {
        const redirectUrl = new URL("/reset-password", requestUrl.origin);
        redirectUrl.hash = `error_code=${error.message.includes('expired') ? 'otp_expired' : 'access_denied'}&error_description=${encodeURIComponent(error.message)}`;
        return NextResponse.redirect(redirectUrl);
      }
      // For non-recovery flows, redirect to login with error
      const redirectUrl = new URL("/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "invalid_reset_link");
      return NextResponse.redirect(redirectUrl);
    }

    // Success - ensure profile exists (account role stays consumer); persist workout_path if provided (best-effort; redirect still happens if admin fails)
    const user = data.session?.user;
    const nextParam = requestUrl.searchParams.get("next");
    const roleParam = requestUrl.searchParams.get("role");
    const pathParam = requestUrl.searchParams.get("workoutPath") ?? requestUrl.searchParams.get("path") ?? roleParam;
    const workoutPathParam = typeof pathParam === "string" && isValidWorkoutPath(pathParam) ? (pathParam as WorkoutPath) : null;

    let admin: ReturnType<typeof import("@/lib/supabaseAdmin").getSupabaseAdminClient> | null = null;
    try {
      const mod = await import("@/lib/supabaseAdmin");
      admin = mod.getSupabaseAdminClient();
    } catch (err) {
      console.error("[auth/callback] admin client init failed (non-blocking)", err);
      admin = null;
    }

    if (admin && user?.id) {
      try {
        const emailPrefix = user.email ? user.email.split("@")[0] : "";
        const incomingEmail = user.email ?? null;
        const incomingDisplayName =
          user.user_metadata?.display_name?.trim()
          || (emailPrefix || null)
          || null;
        const sanitizedPrefix = emailPrefix ? emailPrefix.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64) || null : null;
        const incomingUsername = user.user_metadata?.username?.trim() || sanitizedPrefix || null;

        const { data: existing } = await admin
          .from("profiles")
          .select("id, email, display_name, username")
          .eq("id", user.id)
          .maybeSingle();

        if (existing) {
          // Only fill missing fields to avoid overwriting user-customized profile values (e.g. display_name).
          const hasEmail = typeof existing.email === "string" && existing.email.trim() !== "";
          const hasDisplayName = typeof existing.display_name === "string" && existing.display_name.trim() !== "";
          const hasUsername = typeof existing.username === "string" && existing.username.trim() !== "";
          const updatePatch: Record<string, string> = {};
          if (!hasEmail && incomingEmail) updatePatch.email = incomingEmail;
          if (!hasDisplayName && incomingDisplayName) updatePatch.display_name = incomingDisplayName;
          if (!hasUsername && incomingUsername) updatePatch.username = incomingUsername;
          if (Object.keys(updatePatch).length > 0) {
            updatePatch.updated_at = new Date().toISOString();
            await admin.from("profiles").update(updatePatch).eq("id", user.id);
          }
        } else {
          await admin.from("profiles").insert({
            id: user.id,
            email: incomingEmail,
            role: "consumer",
            display_name: incomingDisplayName,
            username: incomingUsername,
            market_mode_preference: "CBD_WELLNESS",
            updated_at: new Date().toISOString(),
          });
        }
      } catch (profileErr) {
        console.error("[auth/callback] profile update failed (non-blocking)", profileErr);
      }
      if (workoutPathParam) {
        try {
          await admin
            .from("profiles")
            .update({ workout_path: workoutPathParam, updated_at: new Date().toISOString() })
            .eq("id", user.id);
        } catch (pathErr) {
          console.error("[auth/callback] profile update failed (non-blocking)", pathErr);
        }
      }
    }

    // Success - determine redirect based on type
    const type = requestUrl.searchParams.get("type");
    if (type === "recovery") {
      // Always redirect recovery flows to reset-password
      const redirectUrl = new URL("/reset-password", requestUrl.origin);
      return NextResponse.redirect(redirectUrl);
    }

    // Onboarding gating first (same logic as post-login-route), then safe next, then workout_path, then fallback
    const { data: { user: authUser } } = await supabase.auth.getUser();
    let profile: PostLoginProfile = null;
    if (authUser?.id) {
      const { data: row } = await supabase
        .from("profiles")
        .select("role, onboarding_completed_at, consumer_onboarding_completed")
        .eq("id", authUser.id)
        .maybeSingle();
      profile = row
        ? {
            role: row.role ?? null,
            onboarding_completed_at: row.onboarding_completed_at ?? null,
            consumer_onboarding_completed: row.consumer_onboarding_completed ?? null,
          }
        : null;
    }
    const mandatoryRedirect = getPostLoginRoute(profile);
    let redirectPath: string;
    if (mandatoryRedirect === "/onboarding") {
      redirectPath = "/onboarding";
    } else if (isSafeNextPath(nextParam)) {
      redirectPath = nextParam;
    } else if (workoutPathParam) {
      redirectPath = getDefaultRouteForUser({ workoutPath: workoutPathParam });
    } else {
      redirectPath = mandatoryRedirect;
    }
    const redirectUrl = new URL(redirectPath, requestUrl.origin);
    return NextResponse.redirect(redirectUrl);
  }

  // No code provided - redirect to login
  const redirectUrl = new URL("/login", requestUrl.origin);
  redirectUrl.searchParams.set("error", "missing_code");
  return NextResponse.redirect(redirectUrl);
}
