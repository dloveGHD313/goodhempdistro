import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorOnboarding } from "@/lib/server/onboardingGate";

export default async function VendorsSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent("/vendors/settings")}`);
  }

  const result = await requireVendorOnboarding(user.id);
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
