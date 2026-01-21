import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Update inquiry status and vendor note (vendor only)
 * Vendors can only update their own inquiries (enforced by RLS)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { status, vendor_note } = await req.json();

    // Validate status
    if (status && !['new', 'replied', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // Verify inquiry exists and belongs to this vendor (RLS will enforce)
    const { data: inquiry, error: inquiryError } = await supabase
      .from("service_inquiries")
      .select("id, owner_user_id, status, vendor_note")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (inquiryError || !inquiry) {
      return NextResponse.json(
        { error: "Inquiry not found or access denied" },
        { status: 404 }
      );
    }

    // Update inquiry (RLS policy ensures only status and vendor_note can be changed)
    const { data: updatedInquiry, error: updateError } = await supabase
      .from("service_inquiries")
      .update({
        status: status || inquiry.status,
        vendor_note: vendor_note?.trim() || null,
      })
      .eq("id", id)
      .select("id, status, vendor_note")
      .single();

    if (updateError) {
      console.error(`[vendors/inquiries] Error updating inquiry:`, updateError);
      return NextResponse.json(
        { error: "Failed to update inquiry" },
        { status: 500 }
      );
    }

    console.log(`[vendors/inquiries] Inquiry ${id} updated by vendor ${user.id}`);

    return NextResponse.json({
      success: true,
      inquiry: updatedInquiry,
    });
  } catch (error) {
    console.error("[vendors/inquiries] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
