import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type Params = { code: string };

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

  const allowed = ["allows_sale_hemp", "allows_sale_intoxicating", "notes"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  if ("allows_sale_hemp" in updates && typeof updates.allows_sale_hemp !== "boolean") {
    return NextResponse.json({ error: "allows_sale_hemp must be boolean" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("hemp_state_rules")
    .update(updates)
    .eq("state_code", stateCode)
    .select()
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
