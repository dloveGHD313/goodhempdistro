import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { validateProductCompliance, requiresCOA } from "@/lib/compliance";
import { isAdminEmail } from "@/lib/admin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { writeAdminActionLog } from "@/lib/adminActionLog";

/** Full select for product edit + admin detail (status, review fields) */
const PRODUCT_EDIT_SELECT_FULL =
  "id, name, description, price_cents, category_id, active, product_type, coa_url, coa_object_path, delta8_disclaimer_ack, vendor_id, owner_user_id, status, submitted_at, reviewed_at, rejection_reason";

/** Minimal select for product edit when full select fails (schema mismatch / optional columns absent) */
const PRODUCT_EDIT_SELECT_MINIMAL =
  "id, name, description, price_cents, category_id, active, product_type, coa_url, delta8_disclaimer_ack, vendor_id, owner_user_id";

function isColumnOrSchemaError(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    msg.includes("column") && msg.includes("does not exist") ||
    msg.includes("undefined column")
  );
}

/**
 * Get a single product (vendor owner or admin)
 * Two-pass select: full first; on column/schema error, retry with minimal select and fill optional fields.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "SESSION_MISSING" }, { status: 401 });
    }

    const { isAdmin: isAdminByTable } = await requireAdminUsers(req);
    const isAdmin = isAdminByTable || isAdminEmail(user.email);

    let product: Record<string, unknown> | null = null;
    let error: { code?: string | null; message?: string | null } | null = null;

    const { data: fullData, error: fullError } = await supabase
      .from("products")
      .select(PRODUCT_EDIT_SELECT_FULL)
      .eq("id", id)
      .maybeSingle();

    if (fullError && isColumnOrSchemaError(fullError)) {
      console.warn("[vendors/products/GET] full select failed (schema/column), retrying minimal", {
        productId: id,
        code: fullError.code,
        message: fullError.message,
      });
      const { data: minimalData, error: minimalError } = await supabase
        .from("products")
        .select(PRODUCT_EDIT_SELECT_MINIMAL)
        .eq("id", id)
        .maybeSingle();

      if (minimalError) {
        console.error("[vendors/products/GET]", { productId: id, error: minimalError.message });
        return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
      }
      product = minimalData as Record<string, unknown> | null;
      if (product) {
        product.coa_object_path = null;
        product.delta8_disclaimer_ack = product.delta8_disclaimer_ack ?? false;
        product.status = product.status ?? "draft";
        product.submitted_at = null;
        product.reviewed_at = null;
        product.rejection_reason = null;
      }
    } else if (fullError) {
      error = fullError;
    } else {
      product = fullData as Record<string, unknown> | null;
    }

    if (error) {
      console.error("[vendors/products/GET]", { productId: id, error: error.message });
      return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
    }

    if (!product) {
      return NextResponse.json({ error: "Product not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const isOwner = product.owner_user_id === user.id;
    let viaVendor = false;
    if (!isOwner && product.vendor_id) {
      const { data: v } = await supabase
        .from("vendors")
        .select("owner_user_id")
        .eq("id", product.vendor_id)
        .maybeSingle();
      viaVendor = v?.owner_user_id === user.id;
    }
    const owns = isOwner || viaVendor;

    if (!owns && !isAdmin) {
      return NextResponse.json({ error: "Product not found or access denied", code: "ACCESS_DENIED" }, { status: 403 });
    }

    return NextResponse.json({ product });
  } catch (err) {
    console.error("[vendors/products/GET] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Update or delete a product
 * Server-only route - requires vendor authentication and ownership
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "SESSION_MISSING" },
        { status: 401 }
      );
    }
    const { isAdmin: isAdminByTable } = await requireAdminUsers(req);
    const isAdmin = isAdminByTable || isAdminEmail(user.email);

    // Verify access: admin can update any product; vendor can update only own
    const { data: product } = await supabase
      .from("products")
      .select("vendor_id, category_id, vendors!inner(owner_user_id)")
      .eq("id", id)
      .single();

    const vendorOwnerId = Array.isArray(product?.vendors)
      ? (product?.vendors as { owner_user_id: string }[])[0]?.owner_user_id
      : (product?.vendors as { owner_user_id: string } | undefined)?.owner_user_id;
    const isOwner = vendorOwnerId === user.id;
    if (!product) {
      return NextResponse.json(
        { error: "Product not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Product not found or access denied", code: "ACCESS_DENIED" },
        { status: 403 }
      );
    }

    const {
      name,
      description,
      price_cents,
      category_id,
      active,
      product_type,
      coa_url,
      coa_object_path,
      delta8_disclaimer_ack,
    } = await req.json();

    const normalizeCoaObjectPath = (value: unknown) => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      if (/^https?:\/\//i.test(trimmed)) {
        return null;
      }
      if (trimmed.startsWith("coas/")) {
        const withoutPrefix = trimmed.replace(/^coas\//, "");
        const [folderId] = withoutPrefix.split("/");
        if (folderId !== id && folderId !== user.id) {
          return null;
        }
        return withoutPrefix;
      }
      if (trimmed.startsWith(`${id}/`)) {
        return trimmed;
      }
      if (trimmed.startsWith(`${user.id}/`)) {
        return trimmed;
      }
      return null;
    };

    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, owner_user_id, subscription_status")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const subscriptionStatus = vendor?.subscription_status || null;
    const subscriptionActive = subscriptionStatus === "active" || subscriptionStatus === "trialing";

    if (!subscriptionActive && !isAdmin) {
      return NextResponse.json(
        { error: "Active vendor plan required to upload products and COAs." },
        { status: 403 }
      );
    }

    // Get current product to merge compliance fields for validation
    const { data: currentProduct } = await supabase
      .from("products")
      .select("product_type, coa_url, coa_object_path, delta8_disclaimer_ack, category_id")
      .eq("id", id)
      .single();

    const normalizedCoaObjectPath =
      coa_object_path !== undefined ? normalizeCoaObjectPath(coa_object_path) : undefined;

    if (coa_object_path && !normalizedCoaObjectPath) {
      console.warn(
        `[vendor-products] Invalid coa_object_path for user ${user.id}; ignoring payload.`
      );
    }

    // Phase 2: COA required by category — admin bypass
    const categoryIdForCoa = category_id !== undefined ? category_id : currentProduct?.category_id;
    let effectiveRequiresCoa = !isAdmin;
    if (effectiveRequiresCoa && categoryIdForCoa) {
      const { data: category } = await supabase
        .from("categories")
        .select("id, name, slug, parent_id")
        .eq("id", categoryIdForCoa)
        .maybeSingle();
      if (category) {
        effectiveRequiresCoa = requiresCOA({ slug: category.slug, name: category.name });
        if (category.parent_id && effectiveRequiresCoa) {
          const { data: parent } = await supabase
            .from("categories")
            .select("slug, name")
            .eq("id", category.parent_id)
            .maybeSingle();
          if (parent && !requiresCOA({ slug: parent.slug, name: parent.name })) {
            effectiveRequiresCoa = false;
          }
        }
      }
    }

    const compliancePayload = {
      product_type: product_type !== undefined ? product_type : (currentProduct?.product_type || "non_intoxicating"),
      coa_url: coa_url !== undefined ? coa_url : currentProduct?.coa_url,
      coa_object_path:
        coa_object_path !== undefined ? normalizedCoaObjectPath : currentProduct?.coa_object_path,
      delta8_disclaimer_ack: delta8_disclaimer_ack !== undefined ? delta8_disclaimer_ack : currentProduct?.delta8_disclaimer_ack,
    };

    // Validate compliance (COA only when effectiveRequiresCoa; admin bypass)
    const complianceErrors = validateProductCompliance({
      ...compliancePayload,
      category_requires_coa: effectiveRequiresCoa,
    });

    if (complianceErrors.length > 0) {
      return NextResponse.json(
        { error: complianceErrors[0].message, complianceErrors },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (price_cents !== undefined) updates.price_cents = parseInt(price_cents);
    if (category_id !== undefined) updates.category_id = category_id || null;
    if (active !== undefined) updates.active = active === true;
    if (product_type !== undefined) updates.product_type = product_type;
    if (coa_url !== undefined) updates.coa_url = coa_url?.trim() || null;
    if (coa_object_path !== undefined) updates.coa_object_path = normalizedCoaObjectPath;
    if (delta8_disclaimer_ack !== undefined) updates.delta8_disclaimer_ack = delta8_disclaimer_ack === true;

    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select("id, name, price_cents, active")
      .single();

    if (updateError) {
      console.error("Error updating product:", updateError);
      return NextResponse.json(
        { error: "Failed to update product" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Product update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "SESSION_MISSING" },
        { status: 401 }
      );
    }

    const { isAdmin: isAdminByTable } = await requireAdminUsers(req);
    const isAdmin = isAdminByTable || isAdminEmail(user.email);

    // Verify access: admin can delete any product; vendor can delete only own
    const { data: product } = await supabase
      .from("products")
      .select("vendor_id, status, vendors!inner(owner_user_id)")
      .eq("id", id)
      .single();

    const vendorOwnerId = Array.isArray(product?.vendors)
      ? (product?.vendors as { owner_user_id: string }[])[0]?.owner_user_id
      : (product?.vendors as { owner_user_id: string } | undefined)?.owner_user_id;
    const isOwner = vendorOwnerId === user.id;

    if (!product) {
      return NextResponse.json(
        { error: "Product not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Product not found or access denied", code: "ACCESS_DENIED" },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting product:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete product" },
        { status: 500 }
      );
    }

    if (isAdmin) {
      const admin = getSupabaseAdminClient();
      await writeAdminActionLog(admin, {
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "delete",
        entity_id: id,
        prev_status: (product as { status?: string })?.status ?? null,
        new_status: null,
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Product delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
