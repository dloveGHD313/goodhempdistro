import { NextRequest, NextResponse } from "next/server";
import { applySupabaseCookies, createSupabaseRouteClient } from "@/lib/supabaseRoute";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { supabase, response } = createSupabaseRouteClient(req);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    applySupabaseCookies(response, res);
    return res;
  }

  const { commentId } = await params;
  if (!commentId) {
    const res = NextResponse.json({ error: "Comment ID required" }, { status: 400 });
    applySupabaseCookies(response, res);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : null;

  if (!reason) {
    const res = NextResponse.json({ error: "Reason is required" }, { status: 400 });
    applySupabaseCookies(response, res);
    return res;
  }

  const { error } = await supabase.from("post_comment_reports").insert({
    comment_id: commentId,
    reporter_id: user.id,
    reason,
    details: details || null,
  });

  if (error) {
    console.error("[comments/report] insert error:", error);
    const res = NextResponse.json(
      { error: "Failed to submit report", details: error.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  applySupabaseCookies(response, res);
  return res;
}
