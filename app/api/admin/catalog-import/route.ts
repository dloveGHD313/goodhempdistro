import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseCsv, validateRow, type ValidatedRow, type ValidationError } from "@/lib/admin/catalogImport";

/** Force dynamic — uses cookies() via requireAdmin, never statically rendered. */
export const dynamic = "force-dynamic";

type ImportResult = {
  ok: boolean;
  totals: { rows: number; valid: number; inserted: number; updated: number };
  errors: ValidationError[];
  failed_writes: { rowNumber: number; field: string; message: string }[];
};

export async function POST(req: NextRequest): Promise<NextResponse<ImportResult | { error: string }>> {
  // Admin gate — same pattern as the rest of /api/admin/* routes
  const adminCheck = await requireAdmin();
  if (!adminCheck.isAdmin || !adminCheck.user) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const adminUserId = adminCheck.user.id;

  // Body shape: { csv: string } — JSON because file is parsed client-side first.
  let csv: string;
  try {
    const body = await req.json();
    csv = typeof body?.csv === "string" ? body.csv : "";
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body — expected { csv: string }" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!csv.trim()) {
    return NextResponse.json(
      { error: "CSV body is empty" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const admin = createSupabaseAdminClient();

  // Parse CSV
  const { rows, parseErrors } = parseCsv(csv);
  if (parseErrors.length > 0 && rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        totals: { rows: 0, valid: 0, inserted: 0, updated: 0 },
        errors: parseErrors.map((e) => ({ rowNumber: e.rowNumber, field: "_csv", message: e.message })),
        failed_writes: [],
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Build slug → requires_coa lookup from production categories
  const { data: categoryRows, error: categoryErr } = await admin
    .from("categories")
    .select("id, slug, requires_coa");
  if (categoryErr) {
    console.error("[catalog-import] failed to load categories", { message: categoryErr.message });
    return NextResponse.json(
      { error: "Failed to load categories for validation: " + categoryErr.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
  const categoryRequiresCoaBySlug: Record<string, boolean> = {};
  const categoryIdBySlug: Record<string, string> = {};
  for (const c of categoryRows || []) {
    if (c.slug) {
      categoryRequiresCoaBySlug[c.slug] = c.requires_coa === true;
      categoryIdBySlug[c.slug] = c.id;
    }
  }

  // Validate each row
  const allErrors: ValidationError[] = [
    ...parseErrors.map((e) => ({ rowNumber: e.rowNumber, field: "_csv", message: e.message })),
  ];
  const valid: ValidatedRow[] = [];
  for (const row of rows) {
    const result = validateRow(row, { categoryRequiresCoaBySlug });
    if (result.ok) {
      valid.push(result.value);
    } else {
      allErrors.push(...result.errors);
    }
  }

  if (valid.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        totals: { rows: rows.length, valid: 0, inserted: 0, updated: 0 },
        errors: allErrors,
        failed_writes: [],
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Cross-check vendor IDs exist and are active
  const vendorIds = Array.from(new Set(valid.map((r) => r.vendor_id)));
  const { data: vendorRows, error: vendorErr } = await admin
    .from("vendors")
    .select("id, status, owner_user_id")
    .in("id", vendorIds);
  if (vendorErr) {
    console.error("[catalog-import] vendor lookup failed", { message: vendorErr.message });
    return NextResponse.json(
      { error: "Vendor lookup failed: " + vendorErr.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
  const vendorMap: Record<string, { status: string | null; owner_user_id: string | null }> = {};
  for (const v of vendorRows || []) {
    vendorMap[v.id] = { status: v.status, owner_user_id: v.owner_user_id };
  }

  const validAfterVendor: ValidatedRow[] = [];
  for (const v of valid) {
    const vendor = vendorMap[v.vendor_id];
    if (!vendor) {
      allErrors.push({
        rowNumber: v.rowNumber,
        field: "vendor_id",
        message: `vendor_id ${v.vendor_id} not found in vendors table`,
      });
      continue;
    }
    if (vendor.status !== "active") {
      allErrors.push({
        rowNumber: v.rowNumber,
        field: "vendor_id",
        message: `vendor ${v.vendor_id} is not active (status: ${vendor.status ?? "null"})`,
      });
      continue;
    }
    validAfterVendor.push(v);
  }

  // Upsert per row — idempotent on (vendor_id, lower(name)).
  // We do per-row upserts so a single bad row doesn't take down the batch.
  let inserted = 0;
  let updated = 0;
  const failed_writes: ImportResult["failed_writes"] = [];

  for (const v of validAfterVendor) {
    const vendor = vendorMap[v.vendor_id]!;
    const payload = {
      vendor_id: v.vendor_id,
      name: v.name,
      description: v.description,
      price_cents: v.price_cents,
      category_id: categoryIdBySlug[v.category_slug],
      image_url: v.image_url,
      coa_url: v.coa_url,
      product_type: v.product_type,
      ship_to_states: v.ship_to_states,
      hemp_derived_attestation: v.hemp_derived_attestation,
      delta8_disclaimer_ack: v.delta8_disclaimer_ack,
      status: v.status,
      active: v.status === "approved",
      owner_user_id: vendor.owner_user_id,
      reviewed_at: v.status === "approved" ? new Date().toISOString() : null,
      reviewed_by: v.status === "approved" ? adminUserId : null,
      updated_at: new Date().toISOString(),
    };

    // Idempotency: look up existing by (vendor_id, name) case-insensitive
    const { data: existing } = await admin
      .from("products")
      .select("id")
      .eq("vendor_id", v.vendor_id)
      .ilike("name", v.name)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await admin
        .from("products")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        failed_writes.push({
          rowNumber: v.rowNumber,
          field: "_db",
          message: `Update failed: ${error.message}`,
        });
        continue;
      }
      updated++;
    } else {
      const { error } = await admin.from("products").insert(payload);
      if (error) {
        failed_writes.push({
          rowNumber: v.rowNumber,
          field: "_db",
          message: `Insert failed: ${error.message}`,
        });
        continue;
      }
      inserted++;
    }
  }

  const ok = allErrors.length === 0 && failed_writes.length === 0;
  return NextResponse.json(
    {
      ok,
      totals: {
        rows: rows.length,
        valid: validAfterVendor.length,
        inserted,
        updated,
      },
      errors: allErrors,
      failed_writes,
    },
    { status: ok ? 200 : 207, headers: { "Cache-Control": "no-store" } }
  );
}
