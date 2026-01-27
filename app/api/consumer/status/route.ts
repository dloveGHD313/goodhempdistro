import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getConsumerAccessStatus } from "@/lib/consumer-access";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      isSubscribed: false,
      subscriptionStatus: null,
      planKey: null,
      isAdmin: false,
    });
  }

  const status = await getConsumerAccessStatus(user.id, user.email);
  return NextResponse.json(status);
}
