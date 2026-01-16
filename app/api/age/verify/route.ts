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

    // Ensure profiles row exists
    const { data: profileExists } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!profileExists) {
      await supabase.from("profiles").insert({ id: user.id, age_verified: true, role: "consumer" });
    } else {
      await supabase.from("profiles").update({ age_verified: true }).eq("id", user.id);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
