import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
    const admin = createSupabaseAdminClient();

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
    const baseUpdate = {
      status: "approved",
      active: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      rejection_reason: null,
    };

    let { data: updatedProduct, error: updateError } = await admin
      .from("products")
      .update(baseUpdate)
      .eq("id", id)
      .select("id, name, status")
      .single();

    if (
      updateError &&
      /column .* does not exist/i.test(updateError.message || "")
    ) {
      console.warn("[admin/products/approve] Column missing, retrying with status only.");
      const retry = await admin
        .from("products")
        .update({ status: "approved", active: true })
        .eq("id", id)
        .select("id, name, status")
        .single();
      updatedProduct = retry.data;
      updateError = retry.error;
    }

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
