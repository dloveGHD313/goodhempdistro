import { createClient } from "@supabase/supabase-js";

/**
 * Create a Supabase admin client for server-side operations
 * IMPORTANT: Only use in server-side code (API routes, server actions)
 * Never expose this client to the browser
 */
export function getSupabaseAdminClient() {
  // Prefer server-only env var, fallback to public for backward compatibility
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    const error = "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL. Please set it in your environment variables";
    console.error(`[admin-client] ${error}`);
    throw new Error(error);
  }

  if (!serviceRoleKey) {
    const error = "Missing SUPABASE_SERVICE_ROLE_KEY. Please set it in your environment variables";
    console.error(`[admin-client] ${error}`);
    throw new Error(error);
  }

  // Log which URL is being used (for production debugging)
  console.log(`[admin-client] Using Supabase URL: ${supabaseUrl.substring(0, 30)}... (service role key: ${serviceRoleKey ? "present" : "missing"})`);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable auto-refresh and persistence for server-side usage
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
