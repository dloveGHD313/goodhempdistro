import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

async function getVendorData(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get vendor
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, business_name, status")
      .eq("owner_user_id", userId)
      .single();

    if (!vendor) {
      return null;
    }

    // Get products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price_cents, active, created_at")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });

    // Get order count
    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", vendor.id);

    return {
      vendor,
      products: products || [],
      orderCount: count || 0,
    };
  } catch (error) {
    console.error("Error fetching vendor data:", error);
    return null;
  }
}

export default async function VendorDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vendorData = await getVendorData(user.id);

  if (!vendorData) {
    redirect("/vendor-registration");
  }

  const { vendor, products, orderCount } = vendorData;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 text-accent">{vendor.business_name}</h1>
            <p className="text-muted">Vendor Dashboard</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-muted mb-2">Status</h3>
              <span className={`px-3 py-1 rounded text-sm ${
                vendor.status === "active" 
                  ? "bg-green-900/30 text-green-400" 
                  : vendor.status === "pending"
                  ? "bg-yellow-900/30 text-yellow-400"
                  : "bg-red-900/30 text-red-400"
              }`}>
                {vendor.status}
              </span>
            </div>
            
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-muted mb-2">Products</h3>
              <p className="text-3xl font-bold">{products.length}</p>
            </div>
            
            <div className="surface-card p-6">
              <h3 className="text-lg font-semibold text-muted mb-2">Total Orders</h3>
              <p className="text-3xl font-bold">{orderCount}</p>
            </div>
          </div>

          <div className="mb-6">
            <Link href="/vendors/products/new" className="btn-primary">
              + Add New Product
            </Link>
          </div>

          <div className="surface-card p-8">
            <h2 className="text-2xl font-semibold mb-6">Your Products</h2>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted mb-4">No products yet. Create your first product!</p>
                <Link href="/vendors/products/new" className="btn-primary inline-block">
                  Add Product
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <Link key={product.id} href={`/vendors/products/${product.id}/edit`}>
                    <div className="border border-[var(--border)] rounded-lg p-4 hover:bg-[var(--surface)]/50 transition">
                      <h3 className="font-semibold mb-2">{product.name}</h3>
                      <p className="text-accent font-bold mb-2">
                        ${((product.price_cents || 0) / 100).toFixed(2)}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        product.active 
                          ? "bg-green-900/30 text-green-400" 
                          : "bg-gray-900/30 text-gray-400"
                      }`}>
                        {product.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
