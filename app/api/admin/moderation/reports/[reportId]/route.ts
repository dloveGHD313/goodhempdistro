import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { applySupabaseCookies, createSupabaseRouteClient } from "@/lib/supabaseRoute";

const VALID_STATUSES = ["open", "reviewed", "dismissed", "actioned"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { response } = createSupabaseRouteClient(req);
  const { user, isAdmin } = await requireAdminUsers(req);

  if (!user) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    applySupabaseCookies(response, res);
    return res;
  }
  if (!isAdmin) {
    const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    applySupabaseCookies(response, res);
    return res;
  }

  const { reportId } = await params;
  if (!reportId) {
    return NextResponse.json({ error: "Report ID required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (typeof status !== "string" || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json(
      { error: "Invalid status. Must be one of: open, reviewed, dismissed, actioned" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("post_comment_reports")
    .update({ status })
    .eq("id", reportId);

  if (error) {
    console.error("[admin/moderation/reports] update error:", error);
    const res = NextResponse.json(
      { error: "Failed to update report", details: error.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  applySupabaseCookies(response, res);
  return res;
}
