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

  // Detect geo state early — runs on every non-prefetch request, no auth needed.
  // TravelAdvisory client component reads this cookie to detect travel.
  const detectedCountry = request.headers.get("x-vercel-ip-country");
  const detectedRegion = request.headers.get("x-vercel-ip-country-region");
  const shouldSetTravelCookie =
    detectedCountry === "US" &&
    typeof detectedRegion === "string" &&
    detectedRegion.length === 2 &&
    request.cookies.get("ghd_travel_state")?.value !== detectedRegion;

  function applyTravelCookie(res: NextResponse): NextResponse {
    if (shouldSetTravelCookie) {
      res.cookies.set("ghd_travel_state", detectedRegion as string, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 6, // 6 hours — refreshes on travel
        httpOnly: false, // readable by TravelAdvisory client component
      });
    }
    return res;
  }

  // Age gate is now a warning model handled by <AgeGate /> client banner
  // mounted globally in app/layout.tsx. Middleware no longer redirects
  // unverified visitors to /welcome — that broke /pricing, /sitemap.xml,
  // /robots.txt, and the entire SEO crawl path (audit P0 Fix #1, CEO Build #1).
  //
  // Infrastructure paths that should never carry any age-gate UX side-effect:
  // /sitemap.xml, /sitemap-*.xml, /robots.txt, /api/*, /_next/*, /favicon.ico,
  // /come-back-later (the friendly "not 21+" landing). These are exempt by
  // virtue of the client banner not rendering on them (handled in AgeGate
  // component) — middleware itself does no age-gate work.
  //
  // State-law product restrictions are enforced at the PRODUCT level via
  // ship_to_states + hemp_state_rules, not at the request level.


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
        return applyTravelCookie(NextResponse.redirect(redirectUrl));
      }

      return applyTravelCookie(response);
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
      return applyTravelCookie(NextResponse.next());
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
          return applyTravelCookie(response);
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
    return applyTravelCookie(NextResponse.redirect(redirectUrl, 307));
  }

  // Auth-gated routes only.
  //
  // /vendors/* handling (defense-in-depth — see GATE-02):
  //
  // PR #176 removed /vendors/* from this list expecting layout-level
  // redirect() calls to gate authed subroutes. That was insufficient:
  // 9 of 10 authed vendor routes lacked `export const dynamic = "force-dynamic"`,
  // so Next.js statically pre-rendered them at build time and served the
  // cached HTML to anonymous users — the layout session check never ran.
  //
  // This middleware now re-gates /vendors/<reserved>* but explicitly
  // allowlists the public surfaces:
  //   - /vendors                  (directory)
  //   - /vendors/activate         (post-application landing)
  //   - /vendors/<uuid>           (vendor detail — id is a UUID from the
  //                                vendors table primary key, NOT a
  //                                user-controlled handle, so it cannot
  //                                collide with a reserved subroute name)
  //
  // RESERVED_VENDOR_SUBROUTES is the source of truth for which child
  // segments are authed. Adding a new authed subroute under /vendors/?
  // Add it here AND add `export const dynamic = "force-dynamic"` to its
  // layout/page.
  const RESERVED_VENDOR_SUBROUTES = new Set([
    "billing",
    "dashboard",
    "events",
    "orders",
    "payouts",
    "products",
    "referrals",
    "services",
    "settings",
  ]);

  const isVendorAuthedRoute = (() => {
    if (!pathname.startsWith("/vendors/")) return false;
    const segments = pathname.split("/").filter(Boolean); // ["vendors", "<sub>", ...]
    if (segments.length < 2) return false;
    return RESERVED_VENDOR_SUBROUTES.has(segments[1]);
  })();

  const isProtectedPage =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/") ||
    isVendorAuthedRoute ||
    pathname === "/driver/dashboard" ||
    pathname.startsWith("/driver/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isProtectedPage && !isAdminApi) {
    return applyTravelCookie(NextResponse.next());
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return applyTravelCookie(NextResponse.next());
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
    return applyTravelCookie(NextResponse.redirect(redirectUrl));
  }

  return applyTravelCookie(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
