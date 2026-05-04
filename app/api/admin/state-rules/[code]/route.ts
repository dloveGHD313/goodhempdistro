import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type Params = { code: string };

const BOOL_FIELDS = [
  "allows_sale_non_intoxicating",
  "allows_delivery_non_intoxicating",
  "allows_sale_intoxicating",
  "allows_delivery_intoxicating",
] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user || !adminCheck.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const stateCode = code.toUpperCase();

  if (!/^[A-Z]{2}$/.test(stateCode)) {
    return NextResponse.json({ error: "Invalid state code" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  for (const field of BOOL_FIELDS) {
    if (field in body) {
      const v = body[field];
      if (v !== null && v !== true && v !== false) {
        return NextResponse.json(
          { error: `${field} must be true, false, or null` },
          { status: 400 }
        );
      }
      updates[field] = v;
    }
  }

  if ("notes" in body) {
    updates.notes = typeof body.notes === "string" ? body.notes || null : null;
  }

  if ("sources" in body) {
    const src = body.sources;
    if (src !== null && typeof src !== "object" && !Array.isArray(src)) {
      return NextResponse.json({ error: "sources must be a JSON object/array or null" }, { status: 400 });
    }
    updates.sources = src ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("hemp_state_rules")
    .update(updates)
    .eq("state_code", stateCode)
    .select(`
      state_code,
      allows_sale_non_intoxicating,
      allows_delivery_non_intoxicating,
      allows_sale_intoxicating,
      allows_delivery_intoxicating,
      notes,
      sources,
      updated_at
    `)
    .maybeSingle();

  if (error) {
    console.error("[state-rules PATCH]", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "State not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, rule: data });
}
