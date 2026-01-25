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
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const logStage = (stage: string, meta?: Record<string, unknown>) => {
    console.log(`[vendor-products/submit] requestId=${requestId} stage=${stage}`, meta || {});
  };

  const logSupabaseError = (
    stage: string,
    error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null
  ) => {
    console.error(`[vendor-products/submit] requestId=${requestId} stage=${stage} error`, {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
  };

  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await params;
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      logSupabaseError("auth_check", {
        message: userError?.message,
        details: (userError as { details?: string })?.details,
      });
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Unauthorized" }
          : { error: "Unauthorized", requestId },
        { status: 401 }
      );
    }

    logStage("auth_check", {
      userId: user.id,
      productId: id,
    });

    // Verify product exists and belongs to this vendor
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, owner_user_id, status")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (productError) {
      logSupabaseError("fetch_product", productError);
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Failed to fetch product" }
          : { error: "Failed to fetch product", requestId },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Product not found or access denied" }
          : { error: "Product not found or access denied", requestId },
        { status: 404 }
      );
    }

    logStage("fetch_product", {
      status: product.status,
    });

    // Check if product is already submitted or approved
    if (product.status === 'pending_review') {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Product is already pending review" }
          : { error: "Product is already pending review", requestId },
        { status: 400 }
      );
    }

    if (product.status === 'approved') {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Product is already approved" }
          : { error: "Product is already approved", requestId },
        { status: 400 }
      );
    }

    // Update product to pending_review
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({
        status: 'pending_review',
      })
      .eq("id", id)
      .select("id, name, status")
      .single();

    if (updateError) {
      logSupabaseError("update_status", updateError);
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Failed to submit product" }
          : { error: "Failed to submit product", requestId },
        { status: 500 }
      );
    }

    logStage("update_status", {
      productId: id,
      status: updatedProduct?.status,
    });

    // Revalidate relevant paths
    revalidatePath("/vendors/products");
    revalidatePath("/admin/products");

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      message: "Product submitted for review",
    }, { status: 200 });
  } catch (error) {
    console.error(`[vendor-products/submit] requestId=${requestId} Error:`, error);
    return NextResponse.json(
      process.env.NODE_ENV === "production"
        ? { error: "Internal server error" }
        : { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
