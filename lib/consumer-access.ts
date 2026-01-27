import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/admin";

export type ConsumerAccessStatus = {
  isSubscribed: boolean;
  subscriptionStatus: string | null;
  planKey: string | null;
  isAdmin: boolean;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isConsumerSubscriptionActive(status?: string | null) {
  if (!status) {
    return false;
  }
  return ACTIVE_STATUSES.has(status);
}

export async function getConsumerAccessStatus(
  userId: string,
  userEmail?: string | null
): Promise<ConsumerAccessStatus> {
  if (isAdminEmail(userEmail)) {
    return {
      isSubscribed: true,
      subscriptionStatus: "admin",
      planKey: "admin",
      isAdmin: true,
    };
  }

  const supabase = await createSupabaseServerClient();
  type ConsumerRow = {
    user_id: string;
    subscription_status: string | null;
    consumer_plan_key: string | null;
  };

  let record: ConsumerRow | null = null;
  const { data, error } = await supabase
    .from("consumer_subscriptions")
    .select("user_id, subscription_status, consumer_plan_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) {
    record = (data as ConsumerRow | null) ?? null;
  } else {
    const admin = getSupabaseAdminClient();
    const { data: adminData } = await admin
      .from("consumer_subscriptions")
      .select("user_id, subscription_status, consumer_plan_key")
      .eq("user_id", userId)
      .maybeSingle();
    record = (adminData as ConsumerRow | null) ?? null;
  }

  const subscriptionStatus = record?.subscription_status || null;
  const isSubscribed = isConsumerSubscriptionActive(subscriptionStatus);

  return {
    isSubscribed,
    subscriptionStatus,
    planKey: record?.consumer_plan_key || null,
    isAdmin: false,
  };
}
