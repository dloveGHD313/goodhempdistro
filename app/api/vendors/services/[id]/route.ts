import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Update or delete a service
 * Server-only route - requires vendor authentication and ownership
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

    // Verify service ownership
    const { data: service } = await supabase
      .from("services")
      .select("id, owner_user_id, status")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!service) {
      return NextResponse.json(
        { error: "Service not found or access denied" },
        { status: 404 }
      );
    }

    // Can only edit draft or rejected services (not pending or approved)
    if (service.status === 'pending_review') {
      return NextResponse.json(
        { error: "Cannot edit service while it is pending review" },
        { status: 400 }
      );
    }

    // If approved, changing it will require re-submission (status can remain approved but admin can see it changed)
    // For now, allow editing approved services but they may need re-approval

    const { 
      name, 
      title, 
      description, 
      category_id, 
      subcategory_id, 
      pricing_type,
      price_cents,
      coa_object_path
    } = await req.json();

    const serviceName = (name?.trim() || title?.trim());
    if (!serviceName) {
      return NextResponse.json(
        { error: "Service name or title is required" },
        { status: 400 }
      );
    }

    // Verify category is a service category if provided
    if (category_id) {
      const { data: category } = await supabase
        .from("categories")
        .select("id, category_type")
        .eq("id", category_id)
        .maybeSingle();

      if (category && category.category_type !== 'service') {
        return NextResponse.json(
          { error: "Category must be a service category" },
          { status: 400 }
        );
      }
    }

    // Validate pricing
    if (pricing_type && !['flat_fee', 'hourly', 'per_project', 'quote_only'].includes(pricing_type)) {
      return NextResponse.json(
        { error: "Invalid pricing_type" },
        { status: 400 }
      );
    }

    // Price is required if not quote_only
    if (pricing_type && pricing_type !== 'quote_only' && (!price_cents || price_cents < 0)) {
      return NextResponse.json(
        { error: "Price is required for this pricing type" },
        { status: 400 }
      );
    }

    // Generate slug if name changed
    const serviceSlug = name?.trim() 
      ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : undefined;

    // Update service
    const { data: updatedService, error: updateError } = await supabase
      .from("services")
      .update({
        name: name?.trim() || null,
        title: title?.trim() || serviceName,
        description: description?.trim() || null,
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        pricing_type: pricing_type || null,
        price_cents: price_cents ? parseInt(price_cents) : null,
        slug: serviceSlug || undefined,
        coa_object_path: coa_object_path?.trim() || null,
      })
      .eq("id", id)
      .select("id, name, title, status")
      .single();

    if (updateError) {
      console.error(`[vendor-services] Error updating service:`, updateError);
      return NextResponse.json(
        { error: "Failed to update service" },
        { status: 500 }
      );
    }

    console.log(`[vendor-services] Service updated: id=${updatedService.id}`);

    return NextResponse.json({
      success: true,
      service: updatedService,
    });
  } catch (error) {
    console.error("[vendor-services] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
