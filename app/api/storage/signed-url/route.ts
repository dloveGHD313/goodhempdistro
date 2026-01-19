import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { extractStoragePath, createSignedUrl } from "@/lib/storageSignedUrls";

/**
 * Get signed URL for a private storage object
 * Requires authentication and ownership/admin access
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bucket, path } = await req.json();

    if (!bucket || !path) {
      return NextResponse.json(
        { error: "Bucket and path are required" },
        { status: 400 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    // For private buckets, check ownership unless admin
    if (bucket === "driver-docs" || bucket === "logistics-docs") {
      if (!isAdmin) {
        // Check if path starts with user's ID prefix
        const driverPrefix = `drivers/${user.id}/`;
        const logisticsPrefix = `logistics/${user.id}/`;
        
        const hasAccess = 
          path.startsWith(driverPrefix) || 
          path.startsWith(logisticsPrefix);

        if (!hasAccess) {
          return NextResponse.json(
            { error: "Forbidden - You do not have access to this file" },
            { status: 403 }
          );
        }
      }
    }

    // Generate signed URL
    const signedUrl = await createSignedUrl(bucket, path, 600); // 10 minutes

    if (!signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error("Signed URL API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
