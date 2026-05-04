import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const travelState = request.cookies.get("ghd_travel_state")?.value ?? null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ profileState: null, travelState });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_state")
      .eq("id", user.id)
      .maybeSingle();

    const profileState =
      (profile as { onboarding_state?: string | null } | null)?.onboarding_state ?? null;

    return NextResponse.json({ profileState, travelState });
  } catch {
    return NextResponse.json({ profileState: null, travelState });
  }
}
