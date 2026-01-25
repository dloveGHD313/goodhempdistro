import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { revalidatePath } from "next/cache";

/**
 * Reject product (admin only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const logStage = (stage: string, details?: Record<string, unknown>) => {
    console.log(`[admin/products/reject][${requestId}] ${stage}`, details || {});
  };
  try {
    logStage("start");
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      logStage("auth_missing", { reason: adminCheck.reason });
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!adminCheck.isAdmin) {
      logStage("auth_forbidden", { userId: adminCheck.user.id, reason: adminCheck.reason });
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { id } = await params;
    const { reason } = await req.json();
    logStage("payload", { keys: ["reason"], hasReason: Boolean(reason) });

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { ok: false, error: "Rejection reason is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createSupabaseAdminClient();

    // Get product
    logStage("fetch_product", { productId: id });
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, name, status")
      .eq("id", id)
      .maybeSingle();

    if (productError || !product) {
      if (productError) {
        console.error(`[admin/products/reject][${requestId}] product_fetch_error`, {
          code: productError.code,
          message: productError.message,
          details: productError.details,
          hint: productError.hint,
        });
      }
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (product.status !== "pending_review") {
      return NextResponse.json(
        { ok: false, error: `Product is not pending review (current status: ${product.status})` },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Update product to rejected
    const baseUpdate = {
      status: "rejected",
      active: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminCheck.user.id,
      rejection_reason: reason.trim(),
    };

    logStage("update_attempt", { keys: Object.keys(baseUpdate) });
    let updatedProduct: any = null;
    let updateError: any = null;
    const initialUpdate = await admin
      .from("products")
      .update(baseUpdate)
      .eq("id", id)
      .select("id, name, status, rejection_reason")
      .single();
    updatedProduct = initialUpdate.data;
    updateError = initialUpdate.error;

    if (updateError && /column .* does not exist/i.test(updateError.message || "")) {
      console.warn(`[admin/products/reject][${requestId}] column_missing_retry`, {
        message: updateError.message,
      });
      const retry = await admin
        .from("products")
        .update({ status: "rejected", active: false })
        .eq("id", id)
        .select("id, name, status")
        .single();
      updatedProduct = retry.data;
      updateError = retry.error;
      logStage("retry_result", { keys: ["status", "active"], ok: !updateError });
    }

    if (updateError) {
      console.error(`[admin/products/reject][${requestId}] update_error`, {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to reject product",
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    logStage("rejected", {
      productId: id,
      adminId: adminCheck.user.id,
      reasonLength: reason.trim().length,
    });

    // Revalidate paths
    revalidatePath("/admin/products");
    revalidatePath("/vendors/products");

    return NextResponse.json(
      {
        ok: true,
        data: updatedProduct,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[admin/products/reject][${requestId}] unexpected_error`, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
