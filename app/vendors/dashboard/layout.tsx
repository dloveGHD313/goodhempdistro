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

  const access = await getVendorAccessStatus(user.id, user.email);
  if (access.isAdmin) {
    return <>{children}</>;
  }
  if (!access.isVendor) {
    redirect("/vendor-registration");
  }

  return <>{children}</>;
}
