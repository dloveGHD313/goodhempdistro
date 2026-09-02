import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { computeCompUntil, COMP_DEFAULT_PLAN_KEY } from "@/lib/server/vendorComp";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const tier = ["starter", "mid", "top"].includes(body?.tier) ? body.tier : undefined;
    // Founding-vendor comp: optional number of free months (no Stripe subscription required).
    const compUntil = computeCompUntil(body?.compMonths);

    const admin = getSupabaseAdminClient();

    const updatePayload: Record<string, unknown> = {
      status: "active",
      is_approved: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (tier) updatePayload.tier = tier;
    if (compUntil) {
      updatePayload.comp_until = compUntil;
      // Give comped vendors Starter entitlements unless a Stripe plan is already on file.
      const { data: existing } = await admin
        .from("vendors")
        .select("subscription_plan_key")
        .eq("id", id)
        .maybeSingle();
      if (!existing?.subscription_plan_key) updatePayload.subscription_plan_key = COMP_DEFAULT_PLAN_KEY;
      if (!tier) updatePayload.tier = "starter";
    }

    const { data: vendor, error } = await admin
      .from("vendors")
      .update(updatePayload)
      .eq("id", id)
      .select("id, business_name, status, is_approved, owner_user_id, comp_until")
      .single();

    if (error || !vendor) {
      console.error("[admin/vendors/activate] update error", error);
      return NextResponse.json(
        { error: error?.message ?? "Vendor not found" },
        { status: error ? 500 : 404 }
      );
    }

    console.log(
      `[admin/vendors/activate] Vendor ${vendor.id} (${vendor.business_name}) activated by ${adminCheck.user.email}` +
        (compUntil ? ` with comp until ${compUntil}` : "")
    );

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/admin/vendors");
    revalidatePath("/products");

    return NextResponse.json({ ok: true, vendor });
  } catch (err) {
    console.error("[admin/vendors/activate] unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
