import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Create service inquiry (public endpoint - authenticated or anonymous)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await params;
    const { name, email, message } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Verify service exists and is approved + active
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, status, active")
      .eq("id", id)
      .eq("status", "approved")
      .eq("active", true)
      .maybeSingle();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Service not found or not available" },
        { status: 404 }
      );
    }

    // Get user if authenticated (optional)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // Create inquiry
    const { data: inquiry, error: inquiryError } = await supabase
      .from("service_inquiries")
      .insert({
        service_id: id,
        user_id: userId, // null if anonymous
        name: name.trim(),
        email: email.trim(),
        message: message?.trim() || null,
        status: 'new',
        vendor_notified: false,
      })
      .select("id")
      .single();

    if (inquiryError) {
      console.error(`[services/inquire] Error creating inquiry:`, inquiryError);
      return NextResponse.json(
        { error: "Failed to send inquiry" },
        { status: 500 }
      );
    }

    console.log(`[services/inquire] Inquiry ${inquiry.id} created for service ${id} by ${email}`);

    // TODO: Send email notification to vendor (if needed)
    // For now, vendor can see inquiries in their dashboard

    return NextResponse.json({
      success: true,
      inquiry: { id: inquiry.id },
      message: "Your inquiry has been sent successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("[services/inquire] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
