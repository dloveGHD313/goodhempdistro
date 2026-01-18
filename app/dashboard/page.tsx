import { Metadata } from "next";
import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import { createSupabaseServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Dashboard | Good Hemp Distro",
  description: "Your account dashboard",
};

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

async function getDashboardData(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Fetch all orders for accurate stats
    const { data: allOrders, error: allOrdersError } = await supabase
      .from("orders")
      .select("id, status, total_cents, created_at")
      .eq("user_id", userId);

    // Fetch recent orders for display (limit 10)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, status, total_cents, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
    }

    // Calculate totals from all orders
    const totalOrders = allOrders?.length || 0;
    const activeOrders = allOrders?.filter(o => o.status === "pending" || o.status === "processing").length || 0;
    const totalSpent = allOrders?.reduce((sum, order) => sum + (order.total_cents || 0), 0) || 0;

    return {
      orders: orders || [],
      totalOrders,
      activeOrders,
      totalSpent,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return {
      orders: [],
      totalOrders: 0,
      activeOrders: 0,
      totalSpent: 0,
    };
  }
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dashboardData = await getDashboardData(user.id);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Dashboard</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-muted mb-2">Total Orders</h3>
              <p className="text-3xl font-bold">{dashboardData.totalOrders}</p>
            </div>
            
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-muted mb-2">Active Orders</h3>
              <p className="text-3xl font-bold">{dashboardData.activeOrders}</p>
            </div>
            
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-muted mb-2">Total Spent</h3>
              <p className="text-3xl font-bold">${(dashboardData.totalSpent / 100).toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section className="surface-card p-8">
                <h2 className="text-2xl font-semibold mb-6">Recent Orders</h2>
                {dashboardData.orders.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted mb-4">No orders yet</p>
                    <a href="/products" className="btn-primary inline-block">
                      Start Shopping
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.orders.map((order) => (
                      <div
                        key={order.id}
                        className="border border-[var(--border)] rounded-lg p-4 hover:bg-[var(--surface)]/50 transition"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                            <p className="text-sm text-muted">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${((order.total_cents || 0) / 100).toFixed(2)}</p>
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
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="surface-card p-8">
                <h2 className="text-2xl font-semibold mb-6">Order History</h2>
                <div className="text-center py-8">
                  <p className="text-muted">
                    {dashboardData.orders.length === 0 
                      ? "Your order history will appear here"
                      : `Showing ${dashboardData.orders.length} recent orders`}
                  </p>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <div className="surface-card p-6">
                <h3 className="text-xl font-semibold mb-4">Account</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="/account" className="text-muted hover:text-accent transition">
                      Profile Settings
                    </a>
                  </li>
                  <li>
                    <a href="/account/addresses" className="text-muted hover:text-accent transition">
                      Shipping Addresses
                    </a>
                  </li>
                  <li>
                    <a href="/account/payment" className="text-muted hover:text-accent transition">
                      Payment Methods
                    </a>
                  </li>
                </ul>
              </div>

              <div className="surface-card p-6">
                <h3 className="text-xl font-semibold mb-4">Quick Links</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="/products" className="text-muted hover:text-accent transition">
                      Browse Products
                    </a>
                  </li>
                  <li>
                    <a href="/vendors" className="text-muted hover:text-accent transition">
                      View Vendors
                    </a>
                  </li>
                  <li>
                    <a href="/contact" className="text-muted hover:text-accent transition">
                      Contact Support
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
