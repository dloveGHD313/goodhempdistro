import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

/**
 * Submit product for admin review
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

    // Verify product exists and belongs to this vendor
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, owner_user_id, status, category_id, coa_url, coa_object_path")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (productError) {
      console.error(`[vendor-products/submit] Error fetching product:`, productError);
      return NextResponse.json(
        { error: "Failed to fetch product" },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: "Product not found or access denied" },
        { status: 404 }
      );
    }

    // Check if product is already submitted or approved
    if (product.status === 'pending_review') {
      return NextResponse.json(
        { error: "Product is already pending review" },
        { status: 400 }
      );
    }

    if (product.status === 'approved') {
      return NextResponse.json(
        { error: "Product is already approved" },
        { status: 400 }
      );
    }

    // Check if category requires COA
    let categoryRequiresCoa = false;
    if (product.category_id) {
      const { data: category } = await supabase
        .from("categories")
        .select("id, requires_coa, parent_id")
        .eq("id", product.category_id)
        .maybeSingle();

      if (category) {
        categoryRequiresCoa = category.requires_coa;
        
        // Check parent if subcategory doesn't require
        if (category.parent_id && !categoryRequiresCoa) {
          const { data: parent } = await supabase
            .from("categories")
            .select("requires_coa")
            .eq("id", category.parent_id)
            .maybeSingle();
          
          if (parent?.requires_coa) {
            categoryRequiresCoa = true;
          }
        }
      }
    }

    // Require COA if category requires it
    const hasCoa =
      !!product.coa_url ||
      !!product.coa_object_path;
    if (categoryRequiresCoa && !hasCoa) {
      return NextResponse.json(
        { error: "COA is required for this product category before submission" },
        { status: 400 }
      );
    }

    // Update product to pending_review
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({
        status: 'pending_review',
        submitted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, name, status")
      .single();

    if (updateError) {
      console.error(`[vendor-products/submit] Error updating product:`, updateError);
      return NextResponse.json(
        { error: "Failed to submit product" },
        { status: 500 }
      );
    }

    console.log(`[vendor-products/submit] Product ${id} submitted for review by user ${user.id}`);

    // Revalidate relevant paths
    revalidatePath("/vendors/products");
    revalidatePath("/admin/products");

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      message: "Product submitted for review",
    }, { status: 200 });
  } catch (error) {
    console.error("[vendor-products/submit] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
