import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Dashboard | Good Hemp Distro",
  description: "Your account dashboard",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Dashboard</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-muted mb-2">Total Orders</h3>
              <p className="text-3xl font-bold">0</p>
            </div>
            
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-muted mb-2">Active Orders</h3>
              <p className="text-3xl font-bold">0</p>
            </div>
            
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-muted mb-2">Total Spent</h3>
              <p className="text-3xl font-bold">$0.00</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section className="surface-card p-8">
                <h2 className="text-2xl font-semibold mb-6">Recent Orders</h2>
                <div className="text-center py-12">
                  <p className="text-muted mb-4">No orders yet</p>
                  <a href="/products" className="btn-primary inline-block">
                    Start Shopping
                  </a>
                </div>
              </section>

              <section className="surface-card p-8">
                <h2 className="text-2xl font-semibold mb-6">Order History</h2>
                <div className="text-center py-8">
                  <p className="text-muted">Your order history will appear here</p>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <div className="surface-card p-6">
                <h3 className="text-xl font-semibold mb-4">Account</h3>
                <ul className="space-y-3">
                  <li>
                    <a href="/account/profile" className="text-muted hover:text-accent transition">
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
