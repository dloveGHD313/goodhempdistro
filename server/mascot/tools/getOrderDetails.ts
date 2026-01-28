import { createSupabaseServerClient } from "@/lib/supabase";

export type MascotOrderResult = {
  title: string;
  subtitle?: string | null;
  href?: string | null;
  meta?: string | null;
};

export async function getOrderDetails(orderId: string): Promise<MascotOrderResult[]> {
  if (!orderId) return [];
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return [];
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, total_cents, vendor_id, created_at, user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return [];
  }

  let canView = order.user_id === user.id;
  if (!canView && order.vendor_id) {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", order.vendor_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    canView = Boolean(vendor);
  }

  if (!canView) {
    return [];
  }

  const totalLabel =
    typeof order.total_cents === "number" ? `$${(order.total_cents / 100).toFixed(2)}` : "Total TBD";

  return [
    {
      title: `Order ${order.id.slice(0, 8)}…`,
      subtitle: `Status: ${order.status || "unknown"}`,
      href: "/account",
      meta: totalLabel,
    },
  ];
}
