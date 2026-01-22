import { createClient } from "@supabase/supabase-js";

export type AdminClientDiagnostics = {
  supabaseUrl: string;
  serviceRoleKeyPresent: boolean;
};

/**
 * Get diagnostics about the admin client configuration
 * Use this to display diagnostic information in admin pages
 */
export function getAdminClientDiagnostics(): AdminClientDiagnostics {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET";
  const serviceRoleKeyPresent = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    supabaseUrl,
    serviceRoleKeyPresent,
  };
}

/**
 * Create a Supabase admin client for server-side operations
 * IMPORTANT: Only use in server-side code (API routes, server actions)
 * Never expose this client to the browser
 * 
 * Throws an error if SUPABASE_SERVICE_ROLE_KEY is missing (do not use invalid keys)
 */
export function getSupabaseAdminClient() {
  // Prefer server-only env var, fallback to public for backward compatibility
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    const error = "[admin-client] MISSING SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL – admin pages cannot read pending services";
    console.error(error);
    throw new Error(error);
  }

  if (!serviceRoleKey) {
    const error = "[admin-client] MISSING SUPABASE_SERVICE_ROLE_KEY – admin pages cannot read pending services. Set SUPABASE_SERVICE_ROLE_KEY in Vercel Production environment variables and redeploy.";
    console.error(error);
    throw new Error(error);
  }

  // Log which URL is being used (for production debugging)
  console.log(`[admin-client] Using Supabase URL: ${supabaseUrl.substring(0, 50)}... (service role key: present)`);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable auto-refresh and persistence for server-side usage
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
