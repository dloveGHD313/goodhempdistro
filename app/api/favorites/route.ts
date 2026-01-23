import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

const allowedTypes = new Set(["vendor", "product", "service", "event"]);

async function ensureEntityIsVisible(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  entityType: string,
  entityId: string
) {
  if (entityType === "vendor") {
    const { data } = await supabase
      .from("vendors")
      .select("id, is_active, is_approved")
      .eq("id", entityId)
      .eq("is_active", true)
      .eq("is_approved", true)
      .maybeSingle();
    return !!data;
  }

  if (entityType === "product") {
    const { data: product } = await supabase
      .from("products")
      .select("id, vendor_id, status, active")
      .eq("id", entityId)
      .eq("status", "approved")
      .eq("active", true)
      .maybeSingle();
    if (!product?.vendor_id) return false;
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", product.vendor_id)
      .eq("is_active", true)
      .eq("is_approved", true)
      .maybeSingle();
    return !!vendor;
  }

  if (entityType === "service") {
    const { data: service } = await supabase
      .from("services")
      .select("id, vendor_id, status, active")
      .eq("id", entityId)
      .eq("status", "approved")
      .eq("active", true)
      .maybeSingle();
    if (!service?.vendor_id) return false;
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", service.vendor_id)
      .eq("is_active", true)
      .eq("is_approved", true)
      .maybeSingle();
    return !!vendor;
  }

  if (entityType === "event") {
    const { data: event } = await supabase
      .from("events")
      .select("id, vendor_id, status")
      .eq("id", entityId)
      .in("status", ["approved", "published"])
      .maybeSingle();
    if (!event?.vendor_id) return false;
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", event.vendor_id)
      .eq("is_active", true)
      .eq("is_approved", true)
      .maybeSingle();
    return !!vendor;
  }

  return false;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const entityTypeRaw = searchParams.get("entity_type");
  const entityType = entityTypeRaw ? entityTypeRaw.toLowerCase() : null;
  const entityIds = searchParams.get("entity_ids");

  let query = supabase
    .from("favorites")
    .select("id, entity_type, entity_id, created_at")
    .eq("user_id", user.id);

  if (entityType) {
    if (!allowedTypes.has(entityType)) {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }
    query = query.eq("entity_type", entityType);
  }

  if (entityIds) {
    const ids = entityIds.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length > 0) {
      query = query.in("entity_id", ids);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("[favorites] Error fetching favorites:", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }

  return NextResponse.json({ favorites: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entity_type, entity_id } = await req.json();
  const normalizedType = typeof entity_type === "string" ? entity_type.toLowerCase() : "";

  if (!allowedTypes.has(normalizedType) || !entity_id) {
    return NextResponse.json({ error: "Invalid favorite request" }, { status: 400 });
  }

  const isVisible = await ensureEntityIsVisible(supabase, normalizedType, entity_id);
  if (!isVisible) {
    return NextResponse.json({ error: "Entity not available" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("favorites")
    .upsert(
      {
        user_id: user.id,
        entity_type: normalizedType,
        entity_id,
      },
      { onConflict: "user_id,entity_type,entity_id" }
    )
    .select("id, entity_type, entity_id")
    .single();

  if (error) {
    console.error("[favorites] Error saving favorite:", error);
    return NextResponse.json({ error: "Failed to save favorite" }, { status: 500 });
  }

  return NextResponse.json({ favorited: true, favorite: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entity_type, entity_id } = await req.json();
  const normalizedType = typeof entity_type === "string" ? entity_type.toLowerCase() : "";

  if (!allowedTypes.has(normalizedType) || !entity_id) {
    return NextResponse.json({ error: "Invalid favorite request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("entity_type", normalizedType)
    .eq("entity_id", entity_id);

  if (error) {
    console.error("[favorites] Error deleting favorite:", error);
    return NextResponse.json({ error: "Failed to remove favorite" }, { status: 500 });
  }

  return NextResponse.json({ favorited: false });
}
