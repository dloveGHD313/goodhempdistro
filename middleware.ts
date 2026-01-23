import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware for Supabase SSR session refresh and route protection
 * This runs on every request and refreshes the session if needed
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Only process Supabase auth for routes that need it
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If Supabase is not configured, skip auth middleware
    return response;
  }

  // Create Supabase client with cookie handling
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected routes - require authentication
  const protectedRoutes = [
    "/dashboard",
    "/account",
    "/products",
    "/orders",
    "/checkout",
    "/driver/dashboard",
    "/onboarding",
    "/vendors/dashboard",
    "/vendors/products",
    "/vendors/services",
    "/vendors/events",
    "/vendors/settings",
    "/vendor",
  ];
  const isProtectedRoute = protectedRoutes.some((route) => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  // Admin routes - require admin role (checked at page level, but redirect here if not authenticated)
  const isAdminRoute = pathname.startsWith("/admin");

  // Auth pages - redirect to dashboard if already authenticated (but NOT reset-password)
  const authRoutes = ["/login", "/signup", "/auth/reset"];
  const isAuthRoute = authRoutes.includes(pathname);
  
  const isOnboardingRoute = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isVendorOnboardingRoute = pathname === "/onboarding/vendor" || pathname.startsWith("/onboarding/vendor/");
  const isApiRoute = pathname.startsWith("/api");

  // Public auth routes - allow unauthenticated AND authenticated access
  // These routes handle their own auth logic (e.g., reset-password needs session for recovery)
  const publicAuthRoutes = ["/auth/callback", "/reset-password"];
  const isPublicAuthRoute = publicAuthRoutes.some((route) => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Allow public auth routes (callback, reset) - never redirect away from these
  // Reset-password needs to work for both authenticated (recovery) and unauthenticated users
  if (isPublicAuthRoute) {
    return response;
  }

  // Redirect protected routes to login if not authenticated
  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Checkout is gated so consumers complete onboarding before purchase.
  const consumerGateRoutes = [
    "/dashboard",
    "/products",
    "/services",
    "/events",
    "/vendors",
    "/orders",
    "/checkout",
  ];
  const isConsumerGateRoute = consumerGateRoutes.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Consumer onboarding enforcement (marketplace-only)
  if (user && isConsumerGateRoute && !isOnboardingRoute && !isApiRoute) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, consumer_onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[middleware] Error fetching consumer onboarding status:", profileError.message);
    }

    const role = profile?.role ?? "consumer";
    const onboardingCompleted = profile?.consumer_onboarding_completed ?? false;

    if (role === "consumer" && !onboardingCompleted) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/onboarding/consumer";
      return NextResponse.redirect(redirectUrl);
    }
  }

  const vendorToolingRoutes = [
    "/vendor",
    "/vendors/dashboard",
    "/vendors/products",
    "/vendors/services",
    "/vendors/events",
    "/vendors/settings",
  ];
  const isVendorToolingRoute = vendorToolingRoutes.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Vendor onboarding enforcement: block vendor tooling until onboarding complete + terms accepted.
  if (user && isVendorToolingRoute && !isVendorOnboardingRoute && !isApiRoute) {
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, owner_user_id, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (vendorError) {
      console.error("[middleware] Error fetching vendor onboarding status:", vendorError.message);
    }

    if (!vendor) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/vendor-registration";
      return NextResponse.redirect(redirectUrl);
    }

    const vendorOnboardingComplete =
      vendor.vendor_onboarding_completed &&
      vendor.terms_accepted_at &&
      vendor.compliance_acknowledged_at;

    if (!vendorOnboardingComplete) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/onboarding/vendor";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Redirect auth pages to dashboard if already authenticated
  // Note: reset-password is excluded from this because it's in publicAuthRoutes above
  if (isAuthRoute && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
