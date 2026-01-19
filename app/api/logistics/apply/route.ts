import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { extractStoragePath } from "@/lib/storageSignedUrls";

/**
 * Submit logistics application
 * Requires authentication
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { company_name, authority_url, insurance_cert_url, w9_url } = await req.json();

    if (!company_name || !authority_url || !insurance_cert_url) {
      return NextResponse.json(
        { error: "Company name, authority URL, and insurance certificate URL are required" },
        { status: 400 }
      );
    }

    // Check if application already exists
    const { data: existing } = await supabase
      .from("logistics_applications")
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
    const normalizeUrl = (url: string | null | undefined): string | null => {
      if (!url) return null;
      const extracted = extractStoragePath(url, "logistics-docs");
      if (extracted) {
        return `${extracted.bucket}/${extracted.path}`;
      }
      // If already in bucket/path format, return as-is
      if (url.startsWith("logistics-docs/")) {
        return url;
      }
      // Fallback: assume it's a path and add bucket prefix
      return `logistics-docs/${url}`;
    };

    // Create application
    const { data: application, error } = await supabase
      .from("logistics_applications")
      .insert({
        user_id: user.id,
        company_name: company_name.trim(),
        authority_url: normalizeUrl(authority_url),
        insurance_cert_url: normalizeUrl(insurance_cert_url),
        w9_url: normalizeUrl(w9_url),
        status: "pending",
      })
      .select("id, status")
      .single();

    if (error) {
      console.error("Error creating logistics application:", error);
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
    console.error("Logistics application error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
