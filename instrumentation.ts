/**
 * Runs at Node process startup (build + server).
 * Fails early with clear message when Supabase env vars are missing,
 * so we don't crash during prerender with "Missing Supabase environment variables".
 * FIXED: Validates only Supabase vars here; full validation in lib/env-validator.
 */
export async function register() {
  if (typeof window === "undefined") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !key) {
      const missing: string[] = [];
      if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
      if (!key) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      throw new Error(
        `Missing Supabase environment variables: ${missing.join(", ")}. ` +
          "Set them in .env.local or Vercel Environment Variables. See .env.example."
      );
    }
  }
}
