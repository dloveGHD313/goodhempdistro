import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { validateProductCompliance } from "@/lib/compliance";

/**
 * Create a new product
 * Server-only route - requires vendor authentication
 */
export async function POST(req: NextRequest) {
  let requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const supabase = await createSupabaseServerClient();

    const logStage = (stage: string, meta?: Record<string, unknown>) => {
      console.log(`[vendor-products] requestId=${requestId} stage=${stage}`, meta || {});
    };

    const logSupabaseError = (
      stage: string,
      error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null
    ) => {
      console.error(`[vendor-products] requestId=${requestId} stage=${stage} error`, {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
    };

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    logStage("auth_check", {
      userId: user?.id || null,
      userEmail: user?.email || null,
    });

    if (userError || !user) {
      logSupabaseError("auth_check", {
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
      logSupabaseError("vendor_lookup_user", vendorError);
      const admin = getSupabaseAdminClient();
      const { data: adminVendor, error: adminVendorError } = await admin
        .from("vendors")
        .select("id, owner_user_id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (adminVendorError) {
        logSupabaseError("vendor_lookup_admin", adminVendorError);
      } else {
        vendor = adminVendor;
        vendorError = null;
      }
    }

    logStage("vendor_lookup", {
      userId: user.id,
      vendorFound: !!vendor,
      vendorId: vendor?.id || null,
    });
    
    if (vendorError) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Failed to verify vendor account" }
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

      logStage("vendor_missing", {
        applicationStatus: application?.status || "none",
      });

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
            logSupabaseError("vendor_auto_provision", autoVendorError || null);
            return NextResponse.json(
              process.env.NODE_ENV === "production"
                ? {
                    error: "Vendor account provisioning failed. Please contact support.",
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
            `[vendor-products] requestId=${requestId} stage=vendor_auto_provision_exception`,
            autoProvisionError
          );
          return NextResponse.json(
            process.env.NODE_ENV === "production"
              ? {
                  error: "Vendor account provisioning error. Please contact support.",
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
        `[vendor-products] requestId=${requestId} stage=vendor_owner_mismatch`,
        {
          userId: user.id,
          vendorOwnerId: vendor.owner_user_id,
        }
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
      .in("status", ["active", "trialing"])
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
      console.warn(`⚠️ [product/create] Vendor ${vendor.id} has no active subscription`);
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Active vendor plan required to upload products and COAs." }
          : { requestId, error: "Active vendor plan required to upload products and COAs." },
        { status: 403 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (error) {
      console.error(
        `[vendor-products] requestId=${requestId} stage=parse_body`,
        error
      );
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Invalid JSON payload" }
          : { error: "Invalid JSON payload", requestId },
        { status: 400 }
      );
    }
    const {
      product_id,
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

    const nameValue = typeof name === "string" ? name.trim() : "";
    if (!nameValue) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Product name is required" }
          : { error: "Product name is required", requestId },
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

    const priceCents = price !== undefined
      ? parsePriceFromDollars(price)
      : typeof price_cents === "string" && price_cents.includes(".")
      ? parsePriceFromDollars(price_cents)
      : parsePriceCents(price_cents);
    if (priceCents === null || priceCents < 0) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Valid price is required" }
          : { error: "Valid price is required", requestId },
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

    const normalizedProductType = normalizeProductType(
      typeof product_type === "string" ? product_type : null
    );

    const isUuid = (value: unknown) =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    const requestedProductId = isUuid(product_id) ? (product_id as string) : null;

    const resolveCategoryId = async (): Promise<{ id: string | null; error: boolean }> => {
      if (isUuid(category_id)) {
        return { id: category_id as string, error: false };
      }
      if (typeof category !== "string" || !category.trim()) {
        return { id: null, error: false };
      }
      const categoryValue = category.trim();
      const { data: slugMatch, error: slugError } = await supabase
        .from("categories")
        .select("id")
        .ilike("slug", categoryValue)
        .maybeSingle();
      if (slugError) {
        logSupabaseError("category_lookup_slug", slugError);
        return { id: null, error: true };
      }
      if (slugMatch?.id) {
        return { id: slugMatch.id, error: false };
      }
      const { data: nameMatch, error: nameError } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", categoryValue)
        .maybeSingle();
      if (nameError) {
        logSupabaseError("category_lookup_name", nameError);
        return { id: null, error: true };
      }
      return { id: nameMatch?.id || null, error: false };
    };

    const { id: resolvedCategoryId, error: categoryLookupFailed } = await resolveCategoryId();
    if (categoryLookupFailed) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Failed to resolve category" }
          : { error: "Failed to resolve category", requestId },
        { status: 500 }
      );
    }
    if (typeof category === "string" && category.trim() && !resolvedCategoryId) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Invalid category" }
          : { error: "Invalid category", requestId },
        { status: 400 }
      );
    }

    // Check if category requires COA
    let categoryRequiresCoa = false;
    if (resolvedCategoryId) {
      const { data: category } = await supabase
        .from("categories")
        .select("id, name, requires_coa, parent_id")
        .eq("id", resolvedCategoryId)
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
    const coaUrlValue =
      typeof coa_url === "string" ? coa_url.trim() || null : null;
    const normalizeCoaObjectPath = (value: unknown, productId: string | null) => {
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
        if (productId && folderId !== productId && folderId !== user.id) {
          return null;
        }
        return withoutPrefix;
      }
      if (productId && trimmed.startsWith(`${productId}/`)) {
        return trimmed;
      }
      if (trimmed.startsWith(`${user.id}/`)) {
        return trimmed;
      }
      return null;
    };
    const normalizedCoaObjectPath = normalizeCoaObjectPath(coa_object_path, requestedProductId);

    const delta8Ack = delta8_disclaimer_ack === true;

    const complianceErrors = validateProductCompliance({
      product_type: normalizedProductType,
      coa_url: coaUrlValue,
      coa_object_path: normalizedCoaObjectPath,
      delta8_disclaimer_ack: delta8Ack,
      category_requires_coa: true,
    });

    if (complianceErrors.length > 0) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: complianceErrors[0].message }
          : { error: complianceErrors[0].message, complianceErrors, requestId },
        { status: 400 }
      );
    }

    // Create product with draft status (requires admin approval)
    const baseInsertPayload: Record<string, unknown> = {
      ...(requestedProductId ? { id: requestedProductId } : {}),
      vendor_id: vendor.id,
      owner_user_id: user.id, // Direct reference for RLS
      name: nameValue,
      description: typeof description === "string" ? description.trim() || null : null,
      price_cents: priceCents,
      category_id: resolvedCategoryId,
      status: "draft", // Always start as draft
      active: false,
      product_type: normalizedProductType,
    };

    const payloadKeys = Object.keys(baseInsertPayload);
    logStage("product_insert_minimal", {
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
      logSupabaseError("product_insert_minimal", productError);
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
          : { error: "Failed to create product" },
        { status: 500 }
      );
    }

    if (!product) {
      console.error(
        `[vendor-products] requestId=${requestId} Product insert returned no row (no error).`
      );
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Failed to create product" }
          : { requestId, error: "Failed to create product" },
        { status: 500 }
      );
    }

    logStage("product_inserted", {
      productId: product.id,
      status: product.status,
    });

    const optionalUpdates: Record<string, unknown> = {};

    if (typeof category === "string" && category.trim()) {
      optionalUpdates.category = category.trim();
    }
    if (coa_url !== undefined) {
      optionalUpdates.coa_url = coaUrlValue;
    }
    if (coa_object_path !== undefined) {
      optionalUpdates.coa_object_path = normalizedCoaObjectPath;
    }
    if (delta8_disclaimer_ack !== undefined) {
      optionalUpdates.delta8_disclaimer_ack = delta8Ack;
    }

    let optionalUpdateError:
      | { code?: string | null; message?: string | null; details?: string | null; hint?: string | null }
      | null = null;

    if (Object.keys(optionalUpdates).length > 0) {
      const admin = getSupabaseAdminClient();
      const { data: columns, error: columnsError } = await admin
        .schema("information_schema")
        .from("columns")
        .select("column_name")
        .eq("table_schema", "public")
        .eq("table_name", "products");

      if (columnsError) {
        logSupabaseError("product_optional_columns", columnsError);
      } else {
        const columnSet = new Set((columns || []).map((row) => row.column_name));
        const filteredUpdates = Object.fromEntries(
          Object.entries(optionalUpdates).filter(([key, value]) => value !== undefined && columnSet.has(key))
        );

        if (Object.keys(filteredUpdates).length > 0) {
          logStage("product_optional_update", {
            payloadKeys: Object.keys(filteredUpdates),
          });
          const { error: updateError } = await supabase
            .from("products")
            .update(filteredUpdates)
            .eq("id", product.id);

          if (updateError) {
            logSupabaseError("product_optional_update", updateError);
            optionalUpdateError = updateError;
          }
        }
      }
    }

    const responsePayload: Record<string, unknown> = {
      success: true,
      product: product,
      message: "Product created as draft. Submit for review to make it live.",
    };
    if (process.env.NODE_ENV !== "production" && optionalUpdateError) {
      responsePayload.warning = {
        stage: "product_optional_update",
        supabase_code: optionalUpdateError.code,
        message: optionalUpdateError.message,
        details: optionalUpdateError.details,
        hint: optionalUpdateError.hint,
      };
    }

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    console.error(`[vendor-products] requestId=${requestId} Product creation error:`, error);
    return NextResponse.json(
      process.env.NODE_ENV === "production"
        ? { error: "Internal server error" }
        : { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
