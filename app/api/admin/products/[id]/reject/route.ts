import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";

/**
 * Reject product (admin only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await req.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();

    // Get product
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, name, status")
      .eq("id", id)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.status !== 'pending_review') {
      return NextResponse.json(
        { error: `Product is not pending review (current status: ${product.status})` },
        { status: 400 }
      );
    }

    // Update product to rejected
    const { data: updatedProduct, error: updateError } = await admin
      .from("products")
      .update({
        status: 'rejected',
        active: false, // Ensure inactive
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        rejection_reason: reason.trim(),
      })
      .eq("id", id)
      .select("id, name, status, rejection_reason")
      .single();

    if (updateError) {
      console.error("[admin/products/reject] Error updating product:", updateError);
      return NextResponse.json(
        { error: "Failed to reject product" },
        { status: 500 }
      );
    }

    console.log(`[admin/products/reject] Product ${id} rejected by admin ${user.id}: ${reason.substring(0, 50)}...`);

    // Revalidate paths
    revalidatePath("/admin/products");
    revalidatePath("/vendors/products");

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("[admin/products/reject] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
