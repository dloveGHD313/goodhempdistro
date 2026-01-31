import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

type RouteSupabaseClient = ReturnType<typeof createServerClient>;
type RouteCookieOptions = Parameters<NextResponse["cookies"]["set"]>[2];

export function createSupabaseRouteClient(req: NextRequest): {
  supabase: RouteSupabaseClient;
  response: NextResponse;
} {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const response = NextResponse.next();
  const cookieJar = new Map<string, { name: string; value: string; options?: RouteCookieOptions }>();
  req.cookies.getAll().forEach((c) => {
    cookieJar.set(c.name, { name: c.name, value: c.value });
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Array.from(cookieJar.values());
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: RouteCookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieJar.set(name, { name, value, options });
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  return { supabase, response };
}

export function applySupabaseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value);
  });
}
