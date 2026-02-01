import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
