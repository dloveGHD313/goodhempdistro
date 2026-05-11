import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { requiresCOA } from "@/lib/compliance";
import { writeAdminActionLog } from "@/lib/adminActionLog";
import { revalidatePath } from "next/cache";

/**
 * Approve product (admin only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const logStage = (stage: string, details?: Record<string, unknown>) => {
    console.log(`[admin/products/approve][${requestId}] ${stage}`, details || {});
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
    const admin = createSupabaseAdminClient();

    // Get product (include category_id for COA requirement check)
    logStage("fetch_product", { productId: id });
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, name, status, category_id")
      .eq("id", id)
      .maybeSingle();

    if (productError || !product) {
      if (productError) {
        console.error(`[admin/products/approve][${requestId}] product_fetch_error`, {
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
      logStage("invalid_status", { productId: id, status: product.status });
      return NextResponse.json(
        { ok: false, error: `Product is not pending review (current status: ${product.status})` },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Phase 3C: COA must be verified before approval when category requires COA.
    // Reads categories.requires_coa as SSOT (GATE-03 cutover).
    let coaRequired = true;
    if (product.category_id) {
      const { data: category } = await admin
        .from("categories")
        .select("slug, name, requires_coa")
        .eq("id", product.category_id)
        .maybeSingle();
      coaRequired = requiresCOA(category ?? undefined);
    }
    if (coaRequired) {
      const { data: coaDoc } = await admin
        .from("product_documents")
        .select("status")
        .eq("product_id", id)
        .eq("type", "coa")
        .maybeSingle();
      if (!coaDoc || coaDoc.status !== "verified") {
        logStage("coa_not_verified", { productId: id });
        return NextResponse.json(
          { ok: false, error: "COA must be verified before approval" },
          { status: 409, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Update product to approved
    const baseUpdate = {
      status: "approved",
      active: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminCheck.user.id,
      rejection_reason: null,
    };

    logStage("update_attempt", { keys: Object.keys(baseUpdate) });
    let { data: updatedProduct, error: updateError } = await admin
      .from("products")
      .update(baseUpdate)
      .eq("id", id)
      .select("id, name, status")
      .single();

    if (updateError && /column .* does not exist/i.test(updateError.message || "")) {
      console.warn(`[admin/products/approve][${requestId}] column_missing_retry`, {
        message: updateError.message,
      });
      const retry = await admin
        .from("products")
        .update({ status: "approved", active: true })
        .eq("id", id)
        .select("id, name, status")
        .single();
      updatedProduct = retry.data;
      updateError = retry.error;
      logStage("retry_result", { keys: ["status", "active"], ok: !updateError });
    }

    if (updateError) {
      console.error(`[admin/products/approve][${requestId}] update_error`, {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to approve product",
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    logStage("approved", { productId: id, adminId: adminCheck.user.id });

    // Defensive auto-activation: if vendor is not yet active, activate now.
    // Prevents "approved product, invisible vendor" trap for new vendors.
    if (updatedProduct) {
      const { data: fullProduct } = await admin
        .from("products")
        .select("vendor_id")
        .eq("id", id)
        .maybeSingle();
      if (fullProduct?.vendor_id) {
        const { data: vendorRow } = await admin
          .from("vendors")
          .select("id, status")
          .eq("id", fullProduct.vendor_id)
          .maybeSingle();
        if (vendorRow && vendorRow.status !== "active") {
          await admin
            .from("vendors")
            .update({ status: "active", is_approved: true, is_active: true, updated_at: new Date().toISOString() })
            .eq("id", vendorRow.id);
          logStage("vendor_auto_activated", { vendorId: vendorRow.id, prevStatus: vendorRow.status });
        }
      }
    }

    await writeAdminActionLog(admin, {
      actor_user_id: adminCheck.user.id,
      actor_email: adminCheck.user.email ?? null,
      action: "approve",
      entity_id: id,
      prev_status: "pending_review",
      new_status: "approved",
    });

    // Revalidate paths
    revalidatePath("/admin/products");
    revalidatePath("/vendors/products");
    revalidatePath("/products"); // Public listing

    return NextResponse.json(
      {
        ok: true,
        data: updatedProduct,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[admin/products/approve][${requestId}] unexpected_error`, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
