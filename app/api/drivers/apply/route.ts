import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { extractStoragePath } from "@/lib/storageSignedUrls";

/**
 * Submit driver application
 * Public endpoint - requires authentication
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { full_name, phone, city, state, vehicle_type, driver_license_url, insurance_url, mvr_report_url } = await req.json();

    if (!full_name || !phone || !city || !state || !vehicle_type) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate required documents
    if (!driver_license_url || !insurance_url || !mvr_report_url) {
      return NextResponse.json(
        { error: "All required documents must be uploaded: Driver License, Insurance, and MVR Report" },
        { status: 400 }
      );
    }

    // Check if application already exists
    const { data: existing } = await supabase
      .from("driver_applications")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Application already submitted", status: existing.status },
        { status: 409 }
      );
    }

    // Normalize URLs to paths for storage
    // Accepts full URLs or bucket/path format, stores as bucket/path
    const normalizeUrl = (url: string): string => {
      if (!url) return url;
      const extracted = extractStoragePath(url, "driver-docs");
      if (extracted) {
        return `${extracted.bucket}/${extracted.path}`;
      }
      // If already in bucket/path format, return as-is
      if (url.startsWith("driver-docs/")) {
        return url;
      }
      // Fallback: assume it's a path and add bucket prefix
      return `driver-docs/${url}`;
    };

    // Create application
    const { data: application, error } = await supabase
      .from("driver_applications")
      .insert({
        user_id: user.id,
        full_name: full_name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state: state.trim(),
        vehicle_type: vehicle_type.trim(),
        driver_license_url: normalizeUrl(driver_license_url),
        insurance_url: normalizeUrl(insurance_url),
        mvr_report_url: normalizeUrl(mvr_report_url),
        status: "pending",
      })
      .select("id, status")
      .single();

    if (error) {
      console.error("Error creating driver application:", error);
      return NextResponse.json(
        { error: "Failed to submit application" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      application: application,
    }, { status: 201 });
  } catch (error) {
    console.error("Driver application error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
