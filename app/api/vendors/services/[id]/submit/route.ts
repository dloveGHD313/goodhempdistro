import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

/**
 * Submit service for admin review
 * Server-only route - requires vendor authentication
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await params;
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify service exists and belongs to this vendor
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, owner_user_id, status, vendor_id, name, title, category_id")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Service not found or access denied" },
        { status: 404 }
      );
    }

    if (service.status === 'pending_review' || service.status === 'approved') {
      return NextResponse.json(
        { error: `Service is already ${service.status}` },
        { status: 400 }
      );
    }

    // Validate service has required fields for submission
    const serviceName = service.name || service.title;
    if (!serviceName || !serviceName.trim()) {
      return NextResponse.json(
        { error: "Service must have a name or title before submission" },
        { status: 400 }
      );
    }

    // Verify category is a service category
    if (service.category_id) {
      const { data: category } = await supabase
        .from("categories")
        .select("id, category_type")
        .eq("id", service.category_id)
        .maybeSingle();

      if (category && category.category_type !== 'service') {
        return NextResponse.json(
          { error: "Service must use a service category" },
          { status: 400 }
        );
      }
    }

    // TODO: Add vendor tier limit validation for services if needed
    // For now, services don't have tier limits (can add service_limit to vendor_plans later)

    // Update service to pending_review
    const { data: updatedService, error: updateError } = await supabase
      .from("services")
      .update({
        status: 'pending_review',
        submitted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, title, status")
      .single();

    if (updateError) {
      console.error(`[vendor-services/submit] Error updating service:`, updateError);
      return NextResponse.json(
        { error: "Failed to submit service" },
        { status: 500 }
      );
    }

    console.log(`[vendor-services/submit] Service ${id} submitted for review by user ${user.id}`);

    revalidatePath("/vendors/services");
    revalidatePath("/admin/services");

    return NextResponse.json({
      success: true,
      service: updatedService,
      message: "Service submitted for review",
    }, { status: 200 });
  } catch (error) {
    console.error("[vendor-services/submit] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
