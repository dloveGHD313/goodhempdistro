import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "Post ID required" }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({}));
  const reason = typeof payload?.reason === "string" ? payload.reason.trim() : "";

  const { error } = await supabase.from("post_flags").insert({
    post_id: postId,
    flagged_by: user.id,
    reason: reason || null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, message: "Already flagged" });
    }
    console.error("[posts] flag error", error);
    return NextResponse.json({ error: "Failed to flag post" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
