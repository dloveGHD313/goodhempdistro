import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

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

    const { full_name, phone, city, state, vehicle_type } = await req.json();

    if (!full_name || !phone || !city || !state || !vehicle_type) {
      return NextResponse.json(
        { error: "All fields are required" },
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
