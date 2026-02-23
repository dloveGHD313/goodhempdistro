import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      return NextResponse.json({ ok: true, message: "no user" }, { status: 200 });
    }

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existing?.id) {
      const email = user.email ?? null;
      const emailPrefix = email ? email.split("@")[0] : "";
      const displayName =
        (typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()) ||
        emailPrefix ||
        null;
      const username =
        (typeof user.user_metadata?.username === "string" && user.user_metadata.username.trim()) ||
        (emailPrefix ? emailPrefix.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64) || null : null) ||
        null;
      await supabase.from("profiles").insert({
        id: user.id,
        email,
        role: "consumer",
        display_name: displayName,
        username,
        age_verified: true,
        market_mode_preference: "CBD_WELLNESS",
        updated_at: new Date().toISOString(),
      });
    } else {
      await supabase.from("profiles").update({ age_verified: true, updated_at: new Date().toISOString() }).eq("id", user.id);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
