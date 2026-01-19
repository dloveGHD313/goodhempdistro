/**
 * Client-side storage utilities for handling signed URLs
 */

/**
 * Extract bucket and path from stored value (URL or path)
 * Returns bucket and path if it's a storage path format
 */
export function extractBucketAndPath(value: string): { bucket: string; path: string } | null {
  if (!value || !value.trim()) {
    return null;
  }

  // Format: bucket/path/to/file (e.g., driver-docs/drivers/userId/file.pdf)
  const pathMatch = value.match(/^(driver-docs|logistics-docs|coas)\/(.+)$/);
  if (pathMatch) {
    return {
      bucket: pathMatch[1],
      path: pathMatch[2],
    };
  }

  // If it's a full Supabase storage URL, try to extract
  const urlMatch = value.match(/\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\/(.+?)(?:\?|$)/);
  if (urlMatch) {
    return {
      bucket: urlMatch[1],
      path: urlMatch[2],
    };
  }

  // If it looks like a plain path without bucket prefix, assume it's from a known bucket
  // But we can't determine bucket from this, so return null
  return null;
}

/**
 * Check if a value is a storage path (needs signed URL) vs a full public URL
 */
export function needsSignedUrl(value: string): boolean {
  const bucketPath = extractBucketAndPath(value);
  if (!bucketPath) return false;
  
  // Private buckets need signed URLs
  return bucketPath.bucket === "driver-docs" || bucketPath.bucket === "logistics-docs";
}

/**
 * Fetch signed URL from API
 */
export async function fetchSignedUrl(bucket: string, path: string): Promise<string | null> {
  try {
    const response = await fetch("/api/storage/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, path }),
    });

    if (!response.ok) {
      console.error("Failed to fetch signed URL:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error("Error fetching signed URL:", error);
    return null;
  }
}
