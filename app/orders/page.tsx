import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

async function getUserOrders(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        id,
        status,
        total_cents,
        created_at,
        paid_at,
        checkout_session_id,
        order_items (
          id,
          quantity,
          unit_price_cents,
          product:products (
            id,
            name
          )
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      return [];
    }

    return orders || [];
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orders = await getUserOrders(user.id);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">My Orders</h1>

          {orders.length === 0 ? (
            <div className="surface-card p-8 text-center">
              <p className="text-muted mb-4">No orders yet</p>
              <Link href="/products" className="btn-primary inline-block">
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any) => {
                const items = order.order_items || [];
                return (
                  <div key={order.id} className="surface-card p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">Order #{order.id.slice(0, 8)}</h3>
                        <p className="text-sm text-muted">
                          {new Date(order.created_at).toLocaleDateString()} at{" "}
                          {new Date(order.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl text-accent">
                          ${((order.total_cents || 0) / 100).toFixed(2)}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded ${
                          order.status === "paid" 
                            ? "bg-green-900/30 text-green-400" 
                            : order.status === "pending"
                            ? "bg-yellow-900/30 text-yellow-400"
                            : "bg-gray-900/30 text-gray-400"
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {items.length > 0 && (
                      <div className="border-t border-[var(--border)] pt-4 mt-4">
                        <p className="text-sm font-semibold mb-2">Items:</p>
                        <ul className="space-y-1 text-sm text-muted">
                          {items.map((item: any) => (
                            <li key={item.id}>
                              {item.quantity}x {item.product?.name || "Product"} - ${((item.unit_price_cents || 0) / 100).toFixed(2)} each
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
