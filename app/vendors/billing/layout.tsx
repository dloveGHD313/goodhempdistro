import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorOnboarding } from "@/lib/server/onboardingGate";

export default async function VendorsBillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect("/login?redirect=/vendors/billing");
  }

  const result = await requireVendorOnboarding(user.id);
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
