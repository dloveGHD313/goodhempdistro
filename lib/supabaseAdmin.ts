import { createClient } from "@supabase/supabase-js";

/**
 * Single source of truth for Supabase URL resolution
 * Priority:
 * 1. process.env.SUPABASE_URL (server-side)
 * 2. process.env.NEXT_PUBLIC_SUPABASE_URL (fallback)
 * Returns null if empty after trim.
 */
export function resolveSupabaseUrl(): string | null {
  const url1 = process.env.SUPABASE_URL?.trim();
  if (url1 && url1.length > 0) {
    return url1;
  }
  
  const url2 = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url2 && url2.length > 0) {
    return url2;
  }
  
  return null;
}

/**
 * Single source of truth for service role key resolution
 * Priority:
 * 1. SUPABASE_SERVICE_ROLE_KEY
 * 2. SUPABASE_SECRET_KEY
 * 3. SUPABASE_SERVICE_KEY
 * 4. SUPABASE_SERVICE_ROLE
 * Must trim; treat whitespace-only as missing.
 */
export function resolveServiceRoleKey(): string | null {
  const keys = [
    { name: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: "SUPABASE_SECRET_KEY", value: process.env.SUPABASE_SECRET_KEY },
    { name: "SUPABASE_SERVICE_KEY", value: process.env.SUPABASE_SERVICE_KEY },
    { name: "SUPABASE_SERVICE_ROLE", value: process.env.SUPABASE_SERVICE_ROLE },
  ];

  for (const { value } of keys) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

/**
 * Get the source name for the resolved URL
 */
function getUrlSourceName(): "SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_URL" | "none" {
  const url1 = process.env.SUPABASE_URL?.trim();
  if (url1 && url1.length > 0) {
    return "SUPABASE_URL";
  }
  
  const url2 = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url2 && url2.length > 0) {
    return "NEXT_PUBLIC_SUPABASE_URL";
  }
  
  return "none";
}

/**
 * Get the source name for the resolved service role key
 */
function getKeySourceName(): string | null {
  const keys = [
    { name: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: "SUPABASE_SECRET_KEY", value: process.env.SUPABASE_SECRET_KEY },
    { name: "SUPABASE_SERVICE_KEY", value: process.env.SUPABASE_SERVICE_KEY },
    { name: "SUPABASE_SERVICE_ROLE", value: process.env.SUPABASE_SERVICE_ROLE },
  ];

  for (const { name, value } of keys) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.length > 0) {
      return name;
    }
  }

  return null;
}

/**
 * Detect the type of service role key based on its format
 * NEVER logs the actual key value, only the type
 */
function detectKeyType(key: string | null): "jwt" | "sb_secret" | "unknown" | "missing" {
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
 * Admin diagnostics type
 */
export type AdminDiagnostics = {
  supabaseUrlUsed: string | null;
  urlSourceName: "SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_URL" | "none";
  keyPresent: boolean;
  keySourceName: string | null;
  keyLength: number | null;
  keyType: "jwt" | "sb_secret" | "unknown" | "missing";
};

/**
 * Get comprehensive admin diagnostics
 * Returns safe information (no secrets) for display in admin pages
 */
export function getAdminDiagnostics(): AdminDiagnostics {
  const url = resolveSupabaseUrl();
  const urlSource = getUrlSourceName();
  const key = resolveServiceRoleKey();
  const keySource = getKeySourceName();
  const keyType = detectKeyType(key);

  return {
    supabaseUrlUsed: url,
    urlSourceName: urlSource,
    keyPresent: !!key,
    keySourceName: keySource,
    keyLength: key ? key.length : null,
    keyType,
  };
}

/**
 * Create a Supabase admin client for server-side operations
 * IMPORTANT: Only use in server-side code (API routes, server actions)
 * Never expose this client to the browser
 * 
 * Throws a clear error if URL or key is missing (includes which variables are checked)
 */
export function getSupabaseAdminClientOrThrow() {
  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = resolveServiceRoleKey();
  const keyType = detectKeyType(serviceRoleKey);

  if (!supabaseUrl) {
    const error = "[admin-client] MISSING SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL – admin pages cannot read pending services. Set SUPABASE_URL (preferred) or NEXT_PUBLIC_SUPABASE_URL in Vercel Production environment variables.";
    console.error(error);
    throw new Error(error);
  }

  if (!serviceRoleKey) {
    const error = "[admin-client] No server-side service key found. Checked: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE. Set one of these in Vercel Production environment variables and redeploy.";
    console.error(error);
    throw new Error(error);
  }

  // Log which URL is being used and key type (never the key itself)
  const urlPreview = supabaseUrl.length > 50 ? `${supabaseUrl.substring(0, 50)}...` : supabaseUrl;
  const urlSource = getUrlSourceName();
  const keySource = getKeySourceName();
  console.log(
    `[admin-client] Using Supabase URL: ${urlPreview} (source: ${urlSource}, service role key: present, source: ${keySource}, type: ${keyType})`
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable auto-refresh and persistence for server-side usage
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use getSupabaseAdminClientOrThrow() instead
 */
export function getSupabaseAdminClient() {
  return getSupabaseAdminClientOrThrow();
}

/**
 * Legacy diagnostics function for backward compatibility
 * @deprecated Use getAdminDiagnostics() instead
 */
export function getAdminClientDiagnostics() {
  const diag = getAdminDiagnostics();
  return {
    supabaseUrl: diag.supabaseUrlUsed || "NOT_SET",
    serviceRoleKeyPresent: diag.keyPresent,
    serviceRoleKeyType: diag.keyType,
  };
}

/**
 * Legacy safe diagnostics function for backward compatibility
 * @deprecated Use getAdminDiagnostics() instead
 */
export function getSafeAdminDiagnostics() {
  const diag = getAdminDiagnostics();
  return {
    supabaseUrl: diag.supabaseUrlUsed,
    keyPresent: diag.keyPresent,
    keyType: diag.keyType,
  };
}
