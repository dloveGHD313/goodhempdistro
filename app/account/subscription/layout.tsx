import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getConsumerAccessStatus } from "@/lib/consumer-access";

export default async function AccountSubscriptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account/subscription");
  }

  const access = await getConsumerAccessStatus(user.id, user.email);
  if (!access.isSubscribed && !access.isAdmin) {
    redirect("/pricing?tab=consumer&reason=subscription_required");
  }

  return <>{children}</>;
}
