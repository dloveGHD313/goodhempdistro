import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requirePhase15Complete } from "@/lib/server/phase15Gate";
import { requireConsumerOnboarding } from "@/lib/server/onboardingGate";

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const phase15Redirect = await requirePhase15Complete(user?.id ?? null);
  if (phase15Redirect) redirect(phase15Redirect);
  const result = await requireConsumerOnboarding(user?.id ?? null);
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
