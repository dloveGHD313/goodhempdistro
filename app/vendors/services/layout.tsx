import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getVendorAccessStatus } from "@/lib/vendor-access";

export default async function VendorsServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/services");
  }

  const access = await getVendorAccessStatus(user.id, user.email);
  if (access.isAdmin) {
    return <>{children}</>;
  }
  if (!access.isVendor) {
    redirect("/vendor-registration");
  }
  if (!access.isSubscribed) {
    redirect("/pricing?tab=vendor&reason=subscription_required");
  }

  return <>{children}</>;
}
