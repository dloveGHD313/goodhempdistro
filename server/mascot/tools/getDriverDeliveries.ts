import { createSupabaseServerClient } from "@/lib/supabase";

export type MascotDeliveryResult = {
  title: string;
  subtitle?: string | null;
  href?: string | null;
  meta?: string | null;
};

export async function getDriverDeliveries(): Promise<MascotDeliveryResult[]> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return [];
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!driver || driver.status !== "approved") {
    return [];
  }

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, pickup_name, dropoff_name, status, created_at")
    .eq("driver_id", driver.id)
    .order("created_at", { ascending: false })
    .limit(6);

  return (deliveries || []).map((delivery) => ({
    title: `Delivery ${delivery.id.slice(0, 8)}…`,
    subtitle: `${delivery.pickup_name || "Pickup"} → ${delivery.dropoff_name || "Dropoff"}`,
    href: "/driver/dashboard",
    meta: delivery.status ? `Status: ${delivery.status}` : null,
  }));
}
