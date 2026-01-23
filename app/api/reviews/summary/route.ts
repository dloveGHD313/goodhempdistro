import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

const allowedTypes = new Set(["product", "service", "event", "vendor"]);

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const entityTypeRaw = searchParams.get("entity_type");
  const entityType = entityTypeRaw ? entityTypeRaw.toLowerCase() : null;
  const entityIds = searchParams.get("entity_ids");

  if (!entityType || !allowedTypes.has(entityType)) {
    return NextResponse.json({ error: "Invalid review summary query" }, { status: 400 });
  }

  const ids = (entityIds || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ summaries: {} });
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("entity_id, rating")
    .eq("entity_type", entityType)
    .eq("status", "published")
    .in("entity_id", ids);

  if (error) {
    console.error("[reviews/summary] Error fetching summaries:", error);
    return NextResponse.json({ error: "Failed to fetch summaries" }, { status: 500 });
  }

  const summaries: Record<string, { avg: number; count: number }> = {};
  (data || []).forEach((review) => {
    const id = review.entity_id as string;
    if (!summaries[id]) {
      summaries[id] = { avg: 0, count: 0 };
    }
    summaries[id].avg += review.rating;
    summaries[id].count += 1;
  });

  Object.keys(summaries).forEach((id) => {
    summaries[id].avg = summaries[id].avg / summaries[id].count;
  });

  return NextResponse.json({ summaries });
}
