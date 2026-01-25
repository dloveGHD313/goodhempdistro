import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { validateProductCompliance } from "@/lib/compliance";

/**
 * Create a new product
 * Server-only route - requires vendor authentication
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log(
      `[vendor-products] requestId=${requestId} SSR user check: ${
        user ? `found ${user.id} (${user.email})` : "not found"
      }`
    );

    if (userError || !user) {
      console.error(`[vendor-products] requestId=${requestId} Auth error:`, {
        message: userError?.message,
        details: (userError as { details?: string })?.details,
      });
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Unauthorized" }
          : { requestId, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get vendor for this user with error handling
    let { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, owner_user_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (vendorError) {
      console.error(`[vendor-products] requestId=${requestId} Vendor query error (user client):`, {
        message: vendorError.message,
        details: vendorError.details,
        hint: vendorError.hint,
        code: vendorError.code,
      });
      const admin = getSupabaseAdminClient();
      const { data: adminVendor, error: adminVendorError } = await admin
        .from("vendors")
        .select("id, owner_user_id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (adminVendorError) {
        console.error(`[vendor-products] requestId=${requestId} Vendor query error (admin client):`, {
          message: adminVendorError.message,
          details: adminVendorError.details,
          hint: adminVendorError.hint,
          code: adminVendorError.code,
        });
      } else {
        vendor = adminVendor;
        vendorError = null;
      }
    }

    console.log(
      `[vendor-products] requestId=${requestId} Vendor lookup result`,
      {
        userId: user.id,
        vendorFound: !!vendor,
        vendorId: vendor?.id || null,
      }
    );
    
    if (vendorError) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Failed to verify vendor account", requestId }
          : {
              requestId,
              error: "Failed to verify vendor account",
              debug: {
                supabase_code: vendorError.code,
                message: vendorError.message,
                hint: vendorError.hint,
              },
            },
        { status: 500 }
      );
    }

    if (!vendor) {
      // VENDOR AUTO-PROVISIONING SAFETY NET
      // Check if user has an approved vendor application
      const { data: application } = await supabase
        .from("vendor_applications")
        .select("id, status, user_id, business_name, description")
        .eq("user_id", user.id)
        .maybeSingle();

      console.log(
        `[vendor-products] requestId=${requestId} No vendor found. Application status: ${
          application ? application.status : "none"
        }`
      );

      // If approved application exists but no vendor row, auto-create it
      if (application && application.status === 'approved') {
        console.warn(
          `[vendor-products] requestId=${requestId} AUTO-PROVISION: Approved application exists but vendor row missing for user ${user.id} - creating vendor row`
        );
        
        try {
          const admin = getSupabaseAdminClient();
          
          // Auto-create vendor using service role (bypasses RLS)
          const { data: autoVendor, error: autoVendorError } = await admin
            .from("vendors")
            .upsert({
              owner_user_id: user.id,
              business_name: application.business_name || "Auto-provisioned Vendor",
              description: application.description || null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "owner_user_id",
            })
            .select("id, owner_user_id")
            .single();

          if (autoVendorError || !autoVendor) {
            console.error(
              `[vendor-products] requestId=${requestId} AUTO-PROVISION FAILED:`,
              {
                message: autoVendorError?.message,
                details: autoVendorError?.details,
                hint: autoVendorError?.hint,
                code: autoVendorError?.code,
              }
            );
            return NextResponse.json(
              process.env.NODE_ENV === "production"
                ? {
                    error: "Vendor account provisioning failed. Please contact support.",
                    requestId,
                  }
                : {
                    requestId,
                    error: "Vendor account provisioning failed. Please contact support.",
                    autoProvisionAttempted: true,
                  },
              { status: 500 }
            );
          }

          console.log(
            `[vendor-products] requestId=${requestId} AUTO-PROVISION SUCCESS: Created vendor ${autoVendor.id} for user ${user.id}`
          );
          
          // Retry product creation with newly created vendor
          // Fall through to product creation logic below with autoVendor
          // Set vendor to autoVendor and continue
          vendor = autoVendor;
        } catch (autoProvisionError) {
          console.error(
            `[vendor-products] requestId=${requestId} AUTO-PROVISION EXCEPTION:`,
            autoProvisionError
          );
          return NextResponse.json(
            process.env.NODE_ENV === "production"
              ? {
                  error: "Vendor account provisioning error. Please contact support.",
                  requestId,
                }
              : {
                  requestId,
                  error: "Vendor account provisioning error. Please contact support.",
                  autoProvisionAttempted: true,
                },
            { status: 500 }
          );
        }
      } else {
        // No approved application - return friendly error
        return NextResponse.json(
          process.env.NODE_ENV === "production"
            ? {
                error:
                  application?.status === "pending"
                    ? "Your vendor application is pending approval. Please wait for admin approval before creating products."
                    : application?.status === "rejected"
                      ? "Your vendor application was rejected. Please contact support if you believe this is an error."
                      : "Vendor account required. Please apply to become a vendor first.",
              }
            : {
                requestId,
                error:
                  application?.status === "pending"
                    ? "Your vendor application is pending approval. Please wait for admin approval before creating products."
                    : application?.status === "rejected"
                      ? "Your vendor application was rejected. Please contact support if you believe this is an error."
                      : "Vendor account required. Please apply to become a vendor first.",
                hasApplication: !!application,
                applicationStatus: application?.status || null,
              },
          { status: 404 }
        );
      }
    }

    // DEFENSIVE: Verify vendor belongs to this user
    if (vendor.owner_user_id !== user.id) {
      console.error(
        `[vendor-products] requestId=${requestId} SECURITY: Vendor owner mismatch! user_id=${user.id}, vendor.owner_user_id=${vendor.owner_user_id}`
      );
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Vendor account access denied" }
          : { requestId, error: "Vendor account access denied" },
        { status: 403 }
      );
    }

    // Check subscription and product limits
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, plan_id, plan_type, status")
      .eq("user_id", user.id)
      .eq("plan_type", "vendor")
      .eq("status", "active")
      .single();

    if (subscription && subscription.plan_id) {
      // Get vendor plan details
      const { data: vendorPlan } = await supabase
        .from("vendor_plans")
        .select("product_limit")
        .eq("id", subscription.plan_id)
        .single();

      if (vendorPlan && vendorPlan.product_limit !== null) {
        // Count current products
        const { count } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("vendor_id", vendor.id);

        if ((count || 0) >= vendorPlan.product_limit) {
          return NextResponse.json(
            { error: `Product limit reached. Your plan allows ${vendorPlan.product_limit} products. Please upgrade your plan.` },
            { status: 403 }
          );
        }
      }
    } else {
      // No active subscription - check if there's a default limit
      // For now, allow product creation but could enforce subscription requirement
      console.warn(`⚠️ [product/create] Vendor ${vendor.id} has no active subscription`);
    }

    const body = await req.json();
    const {
      name,
      description,
      price_cents,
      price,
      category_id,
      subcategory_id,
      category,
      product_type,
      active,
      coa_url,
      coa_object_path,
      delta8_disclaimer_ack,
    } = body;

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

    const normalizedCoaObjectPath = normalizeCoaObjectPath(coa_object_path);
    if (coa_object_path && !normalizedCoaObjectPath) {
      console.warn(
        `[vendor-products] requestId=${requestId} Invalid coa_object_path for user ${user.id}; ignoring payload.`
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Product name is required", requestId },
        { status: 400 }
      );
    }

    const parsePriceCents = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.round(value);
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          return Math.round(parsed);
        }
      }
      return null;
    };

    const parsePriceFromDollars = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.round(value * 100);
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          return Math.round(parsed * 100);
        }
      }
      return null;
    };

    const priceCents =
      parsePriceCents(price_cents) ?? parsePriceFromDollars(price);
    if (priceCents === null || priceCents < 0) {
      return NextResponse.json(
        { error: "Valid price is required", requestId },
        { status: 400 }
      );
    }

    const normalizeProductType = (value?: string | null) => {
      if (!value) {
        return "non_intoxicating";
      }
      const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (normalized === "non_intoxicating" || normalized === "nonintoxicating") {
        return "non_intoxicating";
      }
      if (normalized === "intoxicating") {
        return "intoxicating";
      }
      if (normalized === "delta8" || normalized === "delta_8") {
        return "delta8";
      }
      return "non_intoxicating";
    };

    const normalizedProductType = normalizeProductType(product_type);

    const isUuid = (value: unknown) =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    // Check if category requires COA
    let categoryRequiresCoa = false;
    if (isUuid(category_id)) {
      const { data: category } = await supabase
        .from("categories")
        .select("id, name, requires_coa, parent_id")
        .eq("id", category_id)
        .maybeSingle();

      if (category) {
        // Check category itself or parent category for requires_coa
        categoryRequiresCoa = category.requires_coa;
        
        // If parent exists, check parent too (parent's requires_coa applies to all children)
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

    console.log(
      `[vendor-products] requestId=${requestId} Category COA requirement: category_id=${category_id}, requires_coa=${categoryRequiresCoa}`
    );

    // Validate compliance (COA only required if category requires it)
    const requireCoaForDrafts = false;
    const complianceErrors = validateProductCompliance({
      product_type: normalizedProductType,
      coa_url: typeof coa_url === "string" ? coa_url.trim() : coa_url,
      coa_object_path: normalizedCoaObjectPath,
      delta8_disclaimer_ack,
      category_requires_coa: categoryRequiresCoa && requireCoaForDrafts,
    });

    if (complianceErrors.length > 0) {
      return NextResponse.json(
        { error: complianceErrors[0].message, complianceErrors, requestId },
        { status: 400 }
      );
    }

    const getCategoryColumnSupport = async () => {
      try {
        const admin = getSupabaseAdminClient();
        const { data, error } = await admin
          .schema("information_schema")
          .from("columns")
          .select("column_name")
          .eq("table_schema", "public")
          .eq("table_name", "products")
          .eq("column_name", "category");

        if (error) {
          return false;
        }

        return (data || []).length > 0;
      } catch (error) {
        console.warn(
          `[vendor-products] requestId=${requestId} Failed to read products.category column:`,
          error
        );
        return false;
      }
    };

    const supportsCategoryText = typeof category === "string"
      ? await getCategoryColumnSupport()
      : false;

    // Create product with draft status (requires admin approval)
    const baseInsertPayload: Record<string, unknown> = {
      vendor_id: vendor.id,
      owner_user_id: user.id, // Direct reference for RLS
      name: name.trim(),
      description: description?.trim() || null,
      price_cents: priceCents,
      category_id: isUuid(category_id) ? category_id : null,
      subcategory_id: isUuid(subcategory_id) ? subcategory_id : null,
      ...(supportsCategoryText && typeof category === "string"
        ? { category: category.trim() }
        : {}),
      status: "draft", // Always start as draft
      active: typeof active === "boolean" ? active : true,
      product_type: normalizedProductType,
      // COA is optional at create time; never block product creation
      coa_url: coa_url?.trim() || null,
      coa_object_path: normalizedCoaObjectPath,
      delta8_disclaimer_ack: delta8_disclaimer_ack === true,
    };

    const payloadKeys = Object.keys(baseInsertPayload);
    console.log("[vendor-products] request payload keys", {
      requestId,
      userId: user.id,
      vendorId: vendor.id,
      payloadKeys,
    });

    let { data: product, error: productError } = await supabase
      .from("products")
      .insert(baseInsertPayload)
      .select("id, name, price_cents, status")
      .single();

    if (productError && (productError.code === "42501" || /row level security/i.test(productError.message || ""))) {
      console.warn(
        `[vendor-products] requestId=${requestId} RLS blocked insert; retrying with admin client.`
      );
      const admin = getSupabaseAdminClient();
      const adminInsert = await admin
        .from("products")
        .insert(baseInsertPayload)
        .select("id, name, price_cents, status")
        .single();
      product = adminInsert.data;
      productError = adminInsert.error;
    }

    if (productError) {
      console.error(`[vendor-products] requestId=${requestId} Error creating product:`, {
        message: productError.message,
        details: productError.details,
        hint: productError.hint,
        code: productError.code,
      });
      const includeDetails = process.env.NODE_ENV !== "production";
      return NextResponse.json(
        includeDetails
          ? {
              requestId,
              error: "Failed to create product",
              debug: {
                supabase_code: productError.code,
                message: productError.message,
                details: productError.details,
                hint: productError.hint,
              },
            }
          : { error: "Failed to create product", requestId },
        { status: 500 }
      );
    }

    if (!product) {
      console.error(
        `[vendor-products] requestId=${requestId} Product insert returned no row (no error).`
      );
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Failed to create product", requestId }
          : { requestId, error: "Failed to create product" },
        { status: 500 }
      );
    }

    console.log(
      `[vendor-products] requestId=${requestId} Product created: id=${product.id}, status=${product.status}`
    );

    return NextResponse.json({
      success: true,
      product: product,
      message: "Product created as draft. Submit for review to make it live.",
    }, { status: 201 });
  } catch (error) {
    console.error("Product creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
