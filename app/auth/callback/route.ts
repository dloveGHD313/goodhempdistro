import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPostLoginRoute, type PostLoginProfile } from "@/lib/routing/postLoginRoute";

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

    // Success - ensure profile exists (idempotent; handle_new_user trigger may have raced or failed)
    const user = data.session?.user;
    if (user?.id) {
      try {
        const { getSupabaseAdminClient } = await import("@/lib/supabaseAdmin");
        const admin = getSupabaseAdminClient();
        await admin
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email ?? null,
              role: "consumer",
              display_name: user.user_metadata?.display_name ?? user.email ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id", ignoreDuplicates: true }
          );
      } catch (profileErr) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[auth/callback] profile upsert:", profileErr);
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

    // For other flows (e.g. email confirm): use post-login routing rule (first-time -> /onboarding)
    const { data: { user } } = await supabase.auth.getUser();
    let profile: PostLoginProfile = null;
    if (user?.id) {
      const { data: row } = await supabase
        .from("profiles")
        .select("role, onboarding_completed_at, consumer_onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      profile = row
        ? {
            role: row.role ?? null,
            onboarding_completed_at: row.onboarding_completed_at ?? null,
            consumer_onboarding_completed: row.consumer_onboarding_completed ?? null,
          }
        : null;
    }
    const redirectPath = getPostLoginRoute(profile);
    const redirectUrl = new URL(redirectPath, requestUrl.origin);
    return NextResponse.redirect(redirectUrl);
  }

  // No code provided - redirect to login
  const redirectUrl = new URL("/login", requestUrl.origin);
  redirectUrl.searchParams.set("error", "missing_code");
  return NextResponse.redirect(redirectUrl);
}
