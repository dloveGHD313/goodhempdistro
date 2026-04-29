import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { awardLoyaltyPoints } from "@/lib/referral";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { referral_code } = await req.json();
  if (!referral_code) return NextResponse.json({ ok: false, error: "No referral code provided" }, { status: 400 });
  const admin = getSupabaseAdminClient();
  const { data: codeRecord } = await admin.from("referral_codes").select("id, user_id, is_active").eq("code", String(referral_code).toUpperCase()).maybeSingle();
  if (!codeRecord?.is_active) return NextResponse.json({ ok: false, error: "Invalid referral code" }, { status: 404 });
  if (codeRecord.user_id === user.id) return NextResponse.json({ ok: false, error: "Cannot use your own referral code" }, { status: 400 });
  const { data: existing } = await admin.from("referral_events").select("id").eq("referred_user_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, message: "Already referred" });
  const { data: refEvent, error } = await admin.from("referral_events").insert({ referral_code_id: codeRecord.id, referrer_user_id: codeRecord.user_id, referred_user_id: user.id, referred_user_email: user.email, event_type: "free_signup", status: "active" }).select().single();
  if (error || !refEvent) return NextResponse.json({ ok: false, error: "Failed to record referral" }, { status: 500 });
  await awardLoyaltyPoints(codeRecord.user_id, user.id, refEvent.id);
  return NextResponse.json({ ok: true, message: "Referral recorded" });
}
