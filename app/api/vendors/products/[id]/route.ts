import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { validateProductCompliance } from "@/lib/compliance";

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
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify vendor ownership of product
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
        const [, ownerId] = trimmed.split("/");
        if (ownerId !== user.id) {
          return null;
        }
        return trimmed;
      }
      if (trimmed.startsWith(`${user.id}/`)) {
        return `coas/${trimmed}`;
      }
      return null;
    };

    // Get current product to merge compliance fields for validation
    const { data: currentProduct } = await supabase
      .from("products")
      .select("product_type, coa_url, coa_object_path, delta8_disclaimer_ack")
      .eq("id", id)
      .single();

    const normalizedCoaObjectPath =
      coa_object_path !== undefined ? normalizeCoaObjectPath(coa_object_path) : undefined;

    if (coa_object_path && !normalizedCoaObjectPath) {
      console.warn(
        `[vendor-products] Invalid coa_object_path for user ${user.id}; ignoring payload.`
      );
    }

    const compliancePayload = {
      product_type: product_type !== undefined ? product_type : (currentProduct?.product_type || "non_intoxicating"),
      coa_url: coa_url !== undefined ? coa_url : currentProduct?.coa_url,
      coa_object_path:
        coa_object_path !== undefined ? normalizedCoaObjectPath : currentProduct?.coa_object_path,
      delta8_disclaimer_ack: delta8_disclaimer_ack !== undefined ? delta8_disclaimer_ack : currentProduct?.delta8_disclaimer_ack,
    };

    // Validate compliance
    const complianceErrors = validateProductCompliance(compliancePayload);

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
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
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
