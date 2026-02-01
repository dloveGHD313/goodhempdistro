import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireConsumerOnboarding } from "@/lib/server/onboardingGate";

export default async function VendorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    redirect("/login?redirect=/vendors/dashboard");
  }
  const result = await requireConsumerOnboarding(user.id);
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
