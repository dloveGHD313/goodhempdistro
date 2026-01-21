import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";

/**
 * Approve product (admin only)
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

    // Update product to approved
    const { data: updatedProduct, error: updateError } = await admin
      .from("products")
      .update({
        status: 'approved',
        active: true, // Auto-activate on approval
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        rejection_reason: null, // Clear any previous rejection reason
      })
      .eq("id", id)
      .select("id, name, status")
      .single();

    if (updateError) {
      console.error("[admin/products/approve] Error updating product:", updateError);
      return NextResponse.json(
        { error: "Failed to approve product" },
        { status: 500 }
      );
    }

    console.log(`[admin/products/approve] Product ${id} approved by admin ${user.id}`);

    // Revalidate paths
    revalidatePath("/admin/products");
    revalidatePath("/vendors/products");
    revalidatePath("/products"); // Public listing

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("[admin/products/approve] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
