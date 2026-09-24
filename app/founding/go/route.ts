import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { claimFoundingSpot } from "@/lib/server/founding";
import {
  FOUNDING_COOKIE,
  FOUNDING_COOKIE_MAX_AGE,
  encodeFoundingCookie,
  normalizeFoundingSource,
} from "@/lib/founding";

export const dynamic = "force-dynamic";

/**
 * Founding Members funnel entry: /founding/go?ref=<source>
 * - Signed in: record the visit (pending row) → /founding, where they pick monthly/annual.
 * - Signed out: drop the ghd_founding cookie and send them to sign up as a vendor; the
 *   cookie is redeemed on the first authenticated hop (auth callback / post-login-route),
 *   so onboarding gating never loses the visit, and /founding picks up from there.
 * The share link itself is /founding?ref=<source>; the page's buttons come here.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const source = normalizeFoundingSource(url.searchParams.get("ref"));

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    await claimFoundingSpot(user.id, { kind: "vendor", source });
    const res = NextResponse.redirect(new URL("/founding", url.origin));
    res.cookies.set(FOUNDING_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const signup = new URL("/signup", url.origin);
  signup.searchParams.set("next", "/founding");
  signup.searchParams.set("role", "vendor");
  const res = NextResponse.redirect(signup);
  res.cookies.set(FOUNDING_COOKIE, encodeFoundingCookie("vendor", source), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    maxAge: FOUNDING_COOKIE_MAX_AGE,
  });
  return res;
}
