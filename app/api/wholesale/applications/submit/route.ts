import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

const BUSINESS_TYPES = [
  "hotel",
  "apartment_multifamily",
  "retail_store",
  "restaurant",
  "distributor",
  "other",
  "na_personal",
] as const;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const business_name = typeof body.business_name === "string" ? body.business_name.trim() : null;
    const business_type =
      typeof body.business_type === "string" && BUSINESS_TYPES.includes(body.business_type as (typeof BUSINESS_TYPES)[number])
        ? body.business_type
        : null;
    const company_size = typeof body.company_size === "string" ? body.company_size.trim() || null : null;
    const products_sourcing = Array.isArray(body.products_sourcing)
      ? body.products_sourcing.filter((x: unknown): x is string => typeof x === "string").slice(0, 50)
      : null;
    const certificate_path = typeof body.certificate_path === "string" ? body.certificate_path.trim() || null : null;

    const { data: existing } = await supabase
      .from("wholesale_applications")
      .select("id, status")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.status === "approved") {
      return NextResponse.json(
        { error: "You already have an approved wholesale application" },
        { status: 400 }
      );
    }

    const row = {
      user_id: user.id,
      status: "pending" as const,
      business_name: business_name ?? null,
      business_type,
      company_size,
      products_sourcing: products_sourcing ?? null,
      certificate_path,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
      notes: null,
    };

    if (existing) {
      const { data: updated, error } = await supabase
        .from("wholesale_applications")
        .update(row)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("[wholesale/submit] update error", error);
        return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
      }
      if (!updated) {
        return NextResponse.json(
          { error: "Update blocked — application may not exist or access denied" },
          { status: 403 }
        );
      }
      return NextResponse.json({ ok: true, id: existing.id });
    }

    const { data: inserted, error } = await supabase.from("wholesale_applications").insert(row).select("id").single();
    if (error) {
      console.error("[wholesale/submit] insert error", error);
      return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (error) {
    console.error("[wholesale/submit]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
