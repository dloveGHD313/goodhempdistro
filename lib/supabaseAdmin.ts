import { createClient } from "@supabase/supabase-js";

/**
 * Create a Supabase admin client for server-side operations
 * IMPORTANT: Only use in server-side code (API routes, server actions)
 * Never expose this client to the browser
 */
export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    const error = "Missing NEXT_PUBLIC_SUPABASE_URL. Please set it in your .env.local";
    console.error(`[admin-client] ${error}`);
    throw new Error(error);
  }

  if (!serviceRoleKey) {
    const error = "Missing SUPABASE_SERVICE_ROLE_KEY. Please set it in your .env.local";
    console.error(`[admin-client] SUPABASE_SERVICE_ROLE_KEY missing`);
    throw new Error(error);
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable auto-refresh and persistence for server-side usage
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
