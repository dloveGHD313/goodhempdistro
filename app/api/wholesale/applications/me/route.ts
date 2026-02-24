import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("wholesale_applications")
      .select("id, status, business_name, business_type, company_size, products_sourcing, certificate_path, submitted_at, reviewed_at, notes")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[wholesale/me]", error);
      return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 });
    }

    return NextResponse.json({ application: data ?? null });
  } catch (error) {
    console.error("[wholesale/me]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
