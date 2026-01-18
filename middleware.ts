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
  const protectedRoutes = ["/dashboard", "/account", "/vendors", "/products", "/orders"];
  const isProtectedRoute = protectedRoutes.some((route) => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Auth pages - redirect to dashboard if already authenticated
  const authRoutes = ["/login", "/signup"];
  const isAuthRoute = authRoutes.includes(pathname);

  // Redirect protected routes to login if not authenticated
  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect auth pages to dashboard if already authenticated
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
