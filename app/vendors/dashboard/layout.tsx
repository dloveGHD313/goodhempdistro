import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getVendorAccessStatus } from "@/lib/vendor-access";

export default async function VendorsDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/dashboard");
  }

  const access = await getVendorAccessStatus(user.id);
  if (!access.isVendor) {
    redirect("/vendor-registration");
  }
  if (!access.isSubscribed) {
    redirect("/pricing?tab=vendor&reason=subscription_required");
  }

  return <>{children}</>;
}
