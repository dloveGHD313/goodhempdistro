import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Extract bucket and path from a Supabase storage URL or path string
 * Supports:
 * - Full URLs: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * - Full URLs: https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?...
 * - Path format: <bucket>/<path>
 * - Plain path: <path> (requires bucket parameter)
 */
export function extractStoragePath(input: string, defaultBucket?: string): { bucket: string; path: string } | null {
  if (!input || !input.trim()) {
    return null;
  }

  const trimmed = input.trim();

  // Handle full Supabase storage URLs
  const urlMatch = trimmed.match(/\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\/(.+?)(?:\?|$)/);
  if (urlMatch) {
    return {
      bucket: urlMatch[1],
      path: urlMatch[2],
    };
  }

  // Handle path format: bucket/path
  const pathMatch = trimmed.match(/^([^\/]+)\/(.+)$/);
  if (pathMatch) {
    return {
      bucket: pathMatch[1],
      path: pathMatch[2],
    };
  }

  // If defaultBucket provided and input looks like a plain path, use it
  if (defaultBucket && !trimmed.includes('/')) {
    return {
      bucket: defaultBucket,
      path: trimmed,
    };
  }

  // If we have defaultBucket and input doesn't start with http, treat as path
  if (defaultBucket && !trimmed.startsWith('http')) {
    // Remove leading slash if present
    const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    return {
      bucket: defaultBucket,
      path: cleanPath,
    };
  }

  return null;
}

/**
 * Create a signed URL for a storage object
 * Uses admin client (server-only)
 * @param bucket - Storage bucket name
 * @param path - Object path within bucket
 * @param expiresInSeconds - URL expiration time (default: 600 seconds = 10 minutes)
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = 600
): Promise<string | null> {
  try {
    const admin = getSupabaseAdminClient();
    
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Error in createSignedUrl:", error);
    return null;
  }
}
