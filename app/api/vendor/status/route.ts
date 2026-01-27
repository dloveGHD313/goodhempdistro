import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getVendorAccessStatus } from "@/lib/vendor-access";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      isVendor: false,
      isSubscribed: false,
      subscriptionStatus: null,
      vendorId: null,
      isAdmin: false,
    });
  }

  const status = await getVendorAccessStatus(user.id, user.email);
  return NextResponse.json(status);
}
