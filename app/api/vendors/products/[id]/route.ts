import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { validateProductCompliance, requiresCOA } from "@/lib/compliance";
import { isAdminEmail } from "@/lib/admin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * Get a single product (vendor owner or admin)
 */
export async function GET(
  _req: NextRequest,
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

    const isAdmin = isAdminEmail(user.email);

    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, description, price_cents, category_id, active, product_type, coa_url, coa_object_path, delta8_disclaimer_ack, vendor_id, owner_user_id")
      .eq("id", id)
      .maybeSingle();

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

    // Verify vendor ownership of product (admin can update via admin routes; this is vendor route)
    const { data: product } = await supabase
      .from("products")
      .select("vendor_id, category_id, vendors!inner(owner_user_id)")
      .eq("id", id)
      .single();

    const vendorOwnerId = Array.isArray(product?.vendors)
      ? (product?.vendors as { owner_user_id: string }[])[0]?.owner_user_id
      : (product?.vendors as { owner_user_id: string } | undefined)?.owner_user_id;
    if (!product || vendorOwnerId !== user.id) {
      return NextResponse.json(
        { error: "Product not found or access denied" },
        { status: 404 }
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

    // Verify vendor ownership
    const { data: product } = await supabase
      .from("products")
      .select("vendor_id, vendors!inner(owner_user_id)")
      .eq("id", id)
      .single();

    if (!product || (product.vendors as any).owner_user_id !== user.id) {
      return NextResponse.json(
        { error: "Product not found or access denied" },
        { status: 404 }
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
