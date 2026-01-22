import { createClient } from "@supabase/supabase-js";

export type AdminClientDiagnostics = {
  supabaseUrl: string;
  serviceRoleKeyPresent: boolean;
  serviceRoleKeyType: "jwt" | "sb_secret" | "unknown" | "missing";
};

/**
 * Get the service role key from environment variables with fallback support
 * Checks multiple possible env var names in order of preference
 */
function getServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    ""
  );
}

/**
 * Detect the type of service role key based on its format
 * NEVER logs the actual key value, only the type
 */
function detectKeyType(key: string): "jwt" | "sb_secret" | "unknown" | "missing" {
  if (!key || key.length === 0) {
    return "missing";
  }
  
  if (key.startsWith("eyJ")) {
    return "jwt";
  }
  
  if (key.startsWith("sb_secret_")) {
    return "sb_secret";
  }
  
  return "unknown";
}

/**
 * Get diagnostics about the admin client configuration
 * Use this to display diagnostic information in admin pages
 */
export function getAdminClientDiagnostics(): AdminClientDiagnostics {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = getServiceRoleKey();
  const serviceRoleKeyPresent = !!serviceRoleKey;
  const serviceRoleKeyType = detectKeyType(serviceRoleKey);

  return {
    supabaseUrl: supabaseUrl || "NOT_SET",
    serviceRoleKeyPresent,
    serviceRoleKeyType,
  };
}

/**
 * Create a Supabase admin client for server-side operations
 * IMPORTANT: Only use in server-side code (API routes, server actions)
 * Never expose this client to the browser
 * 
 * Throws an error if no service role key is found (checks multiple env var names)
 */
export function getSupabaseAdminClient() {
  // Prefer server-only env var, fallback to public for backward compatibility
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = getServiceRoleKey();
  const keyType = detectKeyType(serviceRoleKey);

  if (!supabaseUrl) {
    const error = "[admin-client] MISSING SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL – admin pages cannot read pending services";
    console.error(error);
    throw new Error(error);
  }

  if (!serviceRoleKey) {
    const error = "[admin-client] MISSING service role key – admin pages cannot read pending services. Set ONE of: SUPABASE_SERVICE_ROLE_KEY (preferred), SUPABASE_SECRET_KEY (sb_secret_), or SUPABASE_SERVICE_KEY in Vercel Production environment variables and redeploy.";
    console.error(error);
    throw new Error(error);
  }

  // Log which URL is being used and key type (never the key itself)
  const urlPreview = supabaseUrl.length > 50 ? `${supabaseUrl.substring(0, 50)}...` : supabaseUrl;
  console.log(`[admin-client] Using Supabase URL: ${urlPreview} (service role key: present, type: ${keyType})`);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable auto-refresh and persistence for server-side usage
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
