import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const VALID_STATUSES = ["pending_review", "approved", "rejected", "draft"] as const;

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const logStage = (stage: string, details?: Record<string, unknown>) => {
    console.log(`[admin/products][${requestId}] ${stage}`, details || {});
  };
  try {
    logStage("start");
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      logStage("auth_missing", { reason: adminCheck.reason });
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!adminCheck.isAdmin) {
      logStage("auth_forbidden", { userId: adminCheck.user.id, reason: adminCheck.reason });
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || "pending_review";
    const status = VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])
      ? statusParam
      : "pending_review";
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    const admin = createSupabaseAdminClient();

    logStage("fetch_list", { status, limit });
    const { data, error } = await admin
      .from("products")
      .select("id, name, description, price_cents, status, submitted_at, vendor_id, owner_user_id, created_at")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[admin/products][${requestId}] list_error`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { ok: false, error: "Failed to fetch products", message: error.message, details: error.details, hint: error.hint },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const fetchCount = async (statusValue: string) => {
      const { count } = await admin
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("status", statusValue);
      return count || 0;
    };

    logStage("fetch_counts");
    const [approved, rejected, draft, pending, total] = await Promise.all([
      fetchCount("approved"),
      fetchCount("rejected"),
      fetchCount("draft"),
      fetchCount("pending_review"),
      admin.from("products").select("*", { count: "exact", head: true }).then(({ count }) => count || 0),
    ]);

    const vendorIds = Array.from(new Set((data || []).map((p) => p.vendor_id).filter(Boolean)));
    const ownerIds = Array.from(new Set((data || []).map((p) => p.owner_user_id).filter(Boolean)));

    const { data: vendors } = vendorIds.length
      ? await admin
          .from("vendors")
          .select("id, business_name, owner_user_id")
          .in("id", vendorIds)
      : { data: [] };

    const { data: profiles } = ownerIds.length
      ? await admin
          .from("profiles")
          .select("id, email, display_name")
          .in("id", ownerIds)
      : { data: [] };

    const vendorMap = new Map((vendors || []).map((v) => [v.id, v]));
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const normalized = (data || []).map((p) => ({
      ...p,
      vendors: vendorMap.get(p.vendor_id) || null,
      profiles: profileMap.get(p.owner_user_id) || null,
    }));

    logStage("success", { items: normalized.length });
    return NextResponse.json(
      {
        ok: true,
        data: normalized,
        counts: {
          total,
          pending,
          approved,
          draft,
          rejected,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[admin/products][${requestId}] unexpected_error`, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
