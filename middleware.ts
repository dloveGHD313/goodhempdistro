import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isMaintenanceModeEnabled,
  MAINTENANCE_ALLOWLIST_API_PREFIXES,
  MAINTENANCE_ALLOWLIST_PREFIXES,
  MAINTENANCE_ALLOWLIST_ROUTES,
} from "@/lib/server/maintenance";
import { isAdminEmail } from "@/lib/admin";

/**
 * Slim middleware: Supabase session refresh + auth-only redirects for protected routes.
 * No profiles/vendors queries, onboarding, or market gating.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.headers.get("x-middleware-prefetch") || request.headers.get("purpose") === "prefetch") {
    return NextResponse.next();
  }
  if (request.nextUrl.searchParams.has("__rsc")) {
    return NextResponse.next();
  }

  const isAgeGateExcludedPath =
    pathname === "/welcome" ||
    pathname === "/" ||
    pathname === "/maintenance" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/contact" ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/newsfeed") ||
    pathname.startsWith("/discover") ||
    pathname.startsWith("/vendors") ||
    pathname.startsWith("/services") ||
    pathname.startsWith("/wholesale") ||
    pathname.startsWith("/events") ||
    pathname.startsWith("/learning") ||
    pathname.startsWith("/education") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/affiliate") ||
    pathname.startsWith("/logistics") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/get-started") ||
    pathname.startsWith("/jax-preview") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/newsfeed") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api");

  if (!isAgeGateExcludedPath) {
    const ageGateCookie = request.cookies.get("ghd_age_verified")?.value;
    let isAgeVerified = false;

    if (ageGateCookie) {
      try {
        const parsed = JSON.parse(ageGateCookie) as { verified?: unknown; expiresAt?: unknown };
        const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : Number(parsed.expiresAt);
        isAgeVerified = parsed.verified === true && Number.isFinite(expiresAt) && expiresAt >= Date.now();
      } catch {
        isAgeVerified = false;
      }
    }
    if (!isAgeVerified) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/welcome";
      return NextResponse.redirect(redirectUrl);
    }
  }


  const requiresSessionOnly =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/vendors/payouts");

  if (requiresSessionOnly) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const response = NextResponse.next({
        request: { headers: request.headers },
      });

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/login";
        redirectUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(redirectUrl);
      }

    }
  }

  const maintenanceEnabled = isMaintenanceModeEnabled();

  const isAllowedPrefix = MAINTENANCE_ALLOWLIST_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );
  const isAllowedRoute = MAINTENANCE_ALLOWLIST_ROUTES.includes(pathname);
  const isApiPath = pathname.startsWith("/api/");
  const isAllowedApiPrefix = MAINTENANCE_ALLOWLIST_API_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );

  const isAdminApiPath = pathname.startsWith("/api/admin");
  const isAdminPagePath = pathname === "/admin" || pathname.startsWith("/admin/");

  if (maintenanceEnabled) {
    // Always allow core maintenance, static assets, auth pages, and explicitly allowlisted APIs.
    if (isAllowedPrefix || isAllowedRoute || isAllowedApiPrefix) {
      return NextResponse.next();
    }

    let isAdmin = false;

    if (isAdminApiPath || isAdminPagePath) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const response = NextResponse.next({
          request: { headers: request.headers },
        });

        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options);
              });
            },
          },
        });

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const email = session?.user?.email || null;
        isAdmin = !!email && isAdminEmail(email);

        if (isAdmin) {
          return response;
        }
      }
    }

    if (isApiPath) {
      return NextResponse.json(
        { ok: false, error: "maintenance", message: "Service temporarily unavailable" },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/maintenance";
    return NextResponse.redirect(redirectUrl, 307);
  }

  // Auth-gated routes only: dashboard, account, checkout, vendors/*, driver/dashboard, admin/*
  const isProtectedPage =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/") ||
    pathname === "/vendors" ||
    pathname.startsWith("/vendors/") ||
    pathname === "/driver/dashboard" ||
    pathname.startsWith("/driver/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isProtectedPage && !isAdminApi) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Write ghd_travel_state cookie from Vercel geo headers (no DB call).
  // TravelAdvisory component compares this against profile.onboarding_state client-side.
  const detectedCountry = request.headers.get("x-vercel-ip-country");
  const detectedRegion = request.headers.get("x-vercel-ip-country-region");
  if (detectedCountry === "US" && detectedRegion && detectedRegion.length === 2) {
    const existing = request.cookies.get("ghd_travel_state")?.value;
    if (existing !== detectedRegion) {
      response.cookies.set("ghd_travel_state", detectedRegion, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 6, // 6 hours — refreshes on travel
        httpOnly: false, // readable by TravelAdvisory client component
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
