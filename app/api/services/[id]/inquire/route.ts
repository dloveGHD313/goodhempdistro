import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Create service inquiry (public endpoint - authenticated or anonymous)
 * Security: Do NOT accept vendor_id or owner_user_id from client - derive from DB
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await params;
    const { requester_name, requester_email, requester_phone, message } = await req.json();

    // Validate required fields
    if (!requester_email || !requester_email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requester_email.trim())) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Validate message length (reasonable limit)
    if (message.trim().length > 5000) {
      return NextResponse.json(
        { error: "Message is too long (max 5000 characters)" },
        { status: 400 }
      );
    }

    // Verify service exists and is approved + active
    // Also fetch vendor_id and owner_user_id for inquiry creation
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, vendor_id, owner_user_id, status, active")
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

    // Ensure service has vendor_id and owner_user_id
    if (!service.vendor_id || !service.owner_user_id) {
      console.error(`[services/inquire] Service ${id} missing vendor_id or owner_user_id`);
      return NextResponse.json(
        { error: "Service configuration error" },
        { status: 500 }
      );
    }

    // Basic rate limiting: check if same email submitted inquiry for this service in last 30 seconds
    // This is a simple check - can be enhanced with Redis/etc in production
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const { count: recentCount } = await supabase
      .from("service_inquiries")
      .select("*", { count: "exact", head: true })
      .eq("service_id", id)
      .eq("requester_email", requester_email.trim().toLowerCase())
      .gte("created_at", thirtySecondsAgo);

    if (recentCount && recentCount > 0) {
      return NextResponse.json(
        { error: "Please wait a moment before submitting another inquiry" },
        { status: 429 }
      );
    }

    // Create inquiry with vendor_id and owner_user_id derived from service (NOT from client)
    const { data: inquiry, error: inquiryError } = await supabase
      .from("service_inquiries")
      .insert({
        service_id: id,
        vendor_id: service.vendor_id, // Derived from service, NOT from client
        owner_user_id: service.owner_user_id, // Derived from service, NOT from client
        requester_name: requester_name?.trim() || null,
        requester_email: requester_email.trim().toLowerCase(),
        requester_phone: requester_phone?.trim() || null,
        message: message.trim(),
        status: 'new',
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

    console.log(`[services/inquire] Inquiry ${inquiry.id} created for service ${id} by ${requester_email}`);

    return NextResponse.json({
      ok: true,
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
