import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { revalidatePath } from "next/cache";

const VALID_TARGET_STATUSES = ["pending_review"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const logStage = (stage: string, details?: Record<string, unknown>) => {
    console.log(`[admin/products/status][${requestId}] ${stage}`, details || {});
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
    const body = await req.json().catch(() => ({}));
    const status = typeof body?.status === "string" ? body.status : "";

    if (!VALID_TARGET_STATUSES.includes(status as (typeof VALID_TARGET_STATUSES)[number])) {
      return NextResponse.json(
        { ok: false, error: "Invalid status transition" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createSupabaseAdminClient();
    logStage("fetch_product", { productId: id });
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (productError || !product) {
      if (productError) {
        console.error(`[admin/products/status][${requestId}] product_fetch_error`, {
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

    if (product.status !== "draft") {
      logStage("invalid_status", { productId: id, status: product.status });
      return NextResponse.json(
        { ok: false, error: `Product is not draft (current status: ${product.status})` },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const baseUpdate = {
      status: "pending_review",
      submitted_at: new Date().toISOString(),
    };

    logStage("update_attempt", { keys: Object.keys(baseUpdate) });
    let { data: updatedProduct, error: updateError } = await admin
      .from("products")
      .update(baseUpdate)
      .eq("id", id)
      .select("id, status")
      .single();

    if (updateError && /column .* does not exist/i.test(updateError.message || "")) {
      console.warn(`[admin/products/status][${requestId}] column_missing_retry`, {
        message: updateError.message,
      });
      const retry = await admin
        .from("products")
        .update({ status: "pending_review" })
        .eq("id", id)
        .select("id, status")
        .single();
      updatedProduct = retry.data;
      updateError = retry.error;
      logStage("retry_result", { keys: ["status"], ok: !updateError });
    }

    if (updateError) {
      console.error(`[admin/products/status][${requestId}] update_error`, {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });
      return NextResponse.json(
        { ok: false, error: "Failed to update product status" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    logStage("status_updated", { productId: id, status: updatedProduct?.status });

    revalidatePath("/admin/products");
    revalidatePath("/vendors/products");

    return NextResponse.json(
      { ok: true, data: updatedProduct },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[admin/products/status][${requestId}] unexpected_error`, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
