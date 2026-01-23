import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

const allowedTypes = new Set(["product", "service", "event", "vendor"]);

async function resolveVendorId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  entityType: string,
  entityId: string
) {
  if (entityType === "vendor") {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", entityId)
      .eq("is_active", true)
      .eq("is_approved", true)
      .maybeSingle();
    return vendor?.id || null;
  }

  if (entityType === "product") {
    const { data: product } = await supabase
      .from("products")
      .select("id, vendor_id, status, active")
      .eq("id", entityId)
      .eq("status", "approved")
      .eq("active", true)
      .maybeSingle();
    if (!product?.vendor_id) return null;
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", product.vendor_id)
      .eq("is_active", true)
      .eq("is_approved", true)
      .maybeSingle();
    return vendor?.id || null;
  }

  if (entityType === "service") {
    const { data: service } = await supabase
      .from("services")
      .select("id, vendor_id, status, active")
      .eq("id", entityId)
      .eq("status", "approved")
      .eq("active", true)
      .maybeSingle();
    if (!service?.vendor_id) return null;
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", service.vendor_id)
      .eq("is_active", true)
      .eq("is_approved", true)
      .maybeSingle();
    return vendor?.id || null;
  }

  if (entityType === "event") {
    const { data: event } = await supabase
      .from("events")
      .select("id, vendor_id, status")
      .eq("id", entityId)
      .in("status", ["approved", "published"])
      .maybeSingle();
    if (!event?.vendor_id) return null;
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", event.vendor_id)
      .eq("is_active", true)
      .eq("is_approved", true)
      .maybeSingle();
    return vendor?.id || null;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const entityTypeRaw = searchParams.get("entity_type");
  const entityType = entityTypeRaw ? entityTypeRaw.toLowerCase() : null;
  const entityId = searchParams.get("entity_id");

  if (!entityType || !entityId || !allowedTypes.has(entityType)) {
    return NextResponse.json({ error: "Invalid review query" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("id, user_id, rating, title, body, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[reviews] Error fetching reviews:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }

  return NextResponse.json({ reviews: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entity_type, entity_id, rating, title, body } = await req.json();
  const normalizedType = typeof entity_type === "string" ? entity_type.toLowerCase() : "";

  if (!allowedTypes.has(normalizedType) || !entity_id) {
    return NextResponse.json({ error: "Invalid review request" }, { status: 400 });
  }

  const parsedRating = Number(rating);
  if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  const vendorId = await resolveVendorId(supabase, normalizedType, entity_id);
  if (!vendorId) {
    return NextResponse.json({ error: "Entity not available for review" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("reviews")
    .upsert(
      {
        user_id: user.id,
        vendor_id: vendorId,
        entity_type: normalizedType,
        entity_id,
        rating: parsedRating,
        title: title?.trim() || null,
        body: body?.trim() || null,
        status: "published",
      },
      { onConflict: "user_id,entity_type,entity_id" }
    )
    .select("id, rating, title, body, created_at")
    .single();

  if (error) {
    console.error("[reviews] Error saving review:", error);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  return NextResponse.json({ review: data });
}
