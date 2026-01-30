import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireConsumerOnboarding } from "@/lib/server/onboardingGate";

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent("/events")}`);
  }

  const result = await requireConsumerOnboarding(user.id);
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
