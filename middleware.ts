import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware for Supabase SSR session refresh and route protection
 * This runs on every request and refreshes the session if needed
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }
  const publicRoutes = ["/", "/about", "/get-started", "/login", "/signup", "/newsfeed"];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  if (isPublicRoute) {
    return NextResponse.next();
  }
  if (
    pathname.startsWith("/api/comments") ||
    pathname.startsWith("/comments") ||
    (pathname.startsWith("/api/posts/") && pathname.endsWith("/comments"))
  ) {
    return NextResponse.next();
  }

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

  // Protected routes - require authentication
  const protectedRoutes = [
    "/dashboard",
    "/account",
    "/checkout",
    "/driver/dashboard",
  ];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Vendor tooling - require authentication
  const isVendorRoute = pathname === "/vendors" || pathname.startsWith("/vendors/");

  // Admin routes - require authentication (admin role checked at page level)
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApiRoute = pathname.startsWith("/api/admin");

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

  // Guard admin pages and API routes for authenticated sessions.
  if ((isAdminRoute || isAdminApiRoute) && !user) {
    if (isAdminApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.warn("[middleware] blocked", { path: pathname, reason: "admin_auth" });
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect protected and vendor routes to login if not authenticated
  if ((isProtectedRoute || isVendorRoute) && !user) {
    console.warn("[middleware] blocked", { path: pathname, reason: "protected_auth" });
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
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
     * - comments API and routes
     */
    "/((?!_next/static|_next/image|favicon.ico|api/comments|api/posts/[^/]+/comments|comments|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
