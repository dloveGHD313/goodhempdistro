import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasVendorContext } from "@/lib/authz";
import Footer from "@/components/Footer";

// Force dynamic rendering and disable caching since this page requires authentication
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getVendorData(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Check vendor context first - allows pending applications
    const { hasContext, applicationStatus, hasVendor } = await hasVendorContext(supabase, userId);
    
    if (!hasContext) {
      return null;
    }

    // If user has vendor record, use that
    if (hasVendor) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, owner_user_id, business_name, status, created_at")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (!vendor) {
        return null;
      }

      // DEFENSIVE: Verify the vendor belongs to this user
      if (vendor.owner_user_id !== userId) {
        console.error("[vendors/dashboard] SECURITY: Vendor owner_user_id mismatch!", {
          userId,
          vendor_owner_user_id: vendor.owner_user_id,
        });
        return null;
      }

      // Get products (only if vendor is active)
      const { data: products } = vendor.status === "active"
        ? await supabase
            .from("products")
            .select("id, name, price_cents, active, created_at")
            .eq("vendor_id", vendor.id)
            .order("created_at", { ascending: false })
        : { data: null };

      // Get order count (only if vendor is active)
      const { count } = vendor.status === "active"
        ? await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("vendor_id", vendor.id)
        : { count: 0 };

      return {
        vendor,
        products: products || [],
        orderCount: count || 0,
      };
    }

    // If user only has application (pending/rejected), show pending UI
    if (applicationStatus) {
      const { data: application } = await supabase
        .from("vendor_applications")
        .select("id, user_id, business_name, status, created_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (!application || application.user_id !== userId) {
        return null;
      }

      // Create a pseudo-vendor object for consistent UI
      return {
        vendor: {
          id: application.id,
          owner_user_id: userId,
          business_name: application.business_name,
          status: application.status === "approved" ? "active" : application.status,
          created_at: application.created_at,
        },
        products: [],
        orderCount: 0,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching vendor data:", error);
    return null;
  }
}

export default async function VendorDashboardPage() {
  // Disable caching to ensure fresh data
  noStore();
  
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // CRITICAL: Log SSR user status for debugging
  if (!user) {
    console.error("[vendors/dashboard] SSR user is null - no authenticated session!", {
      userError: userError?.message || null,
    });
    redirect("/login?redirect=/vendors/dashboard");
  }

  console.log(`[vendors/dashboard] SSR user exists: userId=${user.id} email=${user.email || 'no-email'}`);

  // Check vendor context - redirect only if no context at all
  const { hasContext, _debug } = await hasVendorContext(supabase, user.id);
  
  if (!hasContext) {
    // Log debug info for troubleshooting (server-only)
    console.error(`[vendors/dashboard] No vendor context found - redirecting to /vendor-registration`, _debug);
    redirect("/vendor-registration");
  }

  const vendorData = await getVendorData(user.id);

  if (!vendorData) {
    // Fallback redirect if data fetch fails
    redirect("/vendor-registration");
  }

  const { vendor, products, orderCount } = vendorData;

  // Determine status: vendors table should only have 'active', pending/rejected come from applications
  // If vendor.status is 'pending', it's an anomaly (should be cleaned up)
  const isActive = vendor.status === "active";
  const isPending = vendor.status === "pending" || (!isActive && vendor.status !== "suspended" && vendor.status !== "rejected");
  const isRejected = vendor.status === "rejected" || vendor.status === "suspended";
  
  // Log if vendor has unexpected status
  if (vendor.status === "pending") {
    console.warn(`[vendors/dashboard] Vendor ${vendor.id} has status 'pending' - vendors table should only contain active vendors. This may indicate a data integrity issue.`);
  }
  
  const statusConfig = {
    active: {
      icon: "✅",
      title: "Account Active",
      description: "Your vendor account is active and ready to use. You can add products, manage orders, and access all features.",
      bgColor: "bg-green-900/20",
      borderColor: "border-green-600/50",
      textColor: "text-green-400",
    },
    pending: {
      icon: "⏳",
      title: "Application Under Review",
      description: "Your vendor application is being reviewed by our team. We'll notify you once it's been approved.",
      bgColor: "bg-yellow-900/20",
      borderColor: "border-yellow-600/50",
      textColor: "text-yellow-400",
    },
    rejected: {
      icon: "❌",
      title: "Application Rejected",
      description: "Your vendor application was not approved. Please contact support if you have questions.",
      bgColor: "bg-red-900/20",
      borderColor: "border-red-600/50",
      textColor: "text-red-400",
    },
    suspended: {
      icon: "🚫",
      title: "Account Suspended",
      description: "Your vendor account has been suspended. Please contact support for assistance.",
      bgColor: "bg-red-900/20",
      borderColor: "border-red-600/50",
      textColor: "text-red-400",
    },
  };

  const statusInfo = statusConfig[vendor.status as keyof typeof statusConfig] || statusConfig.pending;
  const submissionDate = vendor.created_at 
    ? new Date(vendor.created_at).toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      })
    : "N/A";

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 text-accent">{vendor.business_name}</h1>
            <p className="text-muted">Vendor Dashboard</p>
          </div>

          {/* Status Card */}
          <div className={`surface-card p-6 mb-8 border-2 ${statusInfo.borderColor} ${statusInfo.bgColor}`}>
            <div className="flex items-start gap-4">
              <div className="text-4xl">{statusInfo.icon}</div>
              <div className="flex-1">
                <h2 className={`text-2xl font-bold mb-2 ${statusInfo.textColor}`}>
                  {statusInfo.title}
                </h2>
                <p className="text-muted mb-4">{statusInfo.description}</p>
                {isPending && (
                  <div className="text-sm text-muted">
                    Application submitted on {submissionDate}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Business Profile Summary */}
          <div className="surface-card p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Business Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted mb-1">Business Name</div>
                <div className="font-semibold">{vendor.business_name}</div>
              </div>
              <div>
                <div className="text-sm text-muted mb-1">Account Status</div>
                <span className={`px-3 py-1 rounded text-sm font-semibold ${
                  isActive
                    ? "bg-green-900/30 text-green-400"
                    : isPending
                    ? "bg-yellow-900/30 text-yellow-400"
                    : "bg-red-900/30 text-red-400"
                }`}>
                  {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
                </span>
              </div>
              <div>
                <div className="text-sm text-muted mb-1">Member Since</div>
                <div className="font-semibold">{submissionDate}</div>
              </div>
              {isActive && (
                <>
                  <div>
                    <div className="text-sm text-muted mb-1">Total Products</div>
                    <div className="text-2xl font-bold">{products.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted mb-1">Total Orders</div>
                    <div className="text-2xl font-bold">{orderCount}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Active Vendor Features */}
          {isActive && (
            <>
              <div className="mb-6 flex gap-4 flex-wrap">
                <Link href="/vendors/products/new" className="btn-primary">
                  + Add New Product
                </Link>
                <Link href="/vendors/services/inquiries" className="btn-secondary">
                  💬 Service Inquiries
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
            </>
          )}

          {/* Locked Features for Pending/Rejected Vendors */}
          {!isActive && (
            <div className="space-y-6">
              {/* Product Upload Locked */}
              <div className="surface-card p-6 border border-[var(--border)] opacity-60">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">🔒</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">Product Upload</h3>
                    <p className="text-muted mb-4">
                      Add and manage your products once your vendor account is approved.
                    </p>
                    <div className="text-sm text-muted">
                      {isPending 
                        ? "Available after approval"
                        : "Please contact support to reactivate your account"
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Storefront Locked */}
              <div className="surface-card p-6 border border-[var(--border)] opacity-60">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">🔒</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">Storefront</h3>
                    <p className="text-muted mb-4">
                      Customize your vendor storefront and showcase your products to customers.
                    </p>
                    <div className="text-sm text-muted">
                      {isPending 
                        ? "Available after approval"
                        : "Please contact support to reactivate your account"
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Payouts Locked */}
              <div className="surface-card p-6 border border-[var(--border)] opacity-60">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">🔒</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">Payouts & Earnings</h3>
                    <p className="text-muted mb-4">
                      Track your sales, earnings, and manage payout settings.
                    </p>
                    <div className="text-sm text-muted">
                      {isPending 
                        ? "Available after approval"
                        : "Please contact support to reactivate your account"
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Help Section */}
              <div className="surface-card p-6 border border-accent/30">
                <h3 className="text-xl font-semibold mb-2">Need Help?</h3>
                <p className="text-muted mb-4">
                  {isPending 
                    ? "We're reviewing your application and will notify you via email once it's been processed. This typically takes 1-3 business days."
                    : "If you believe this is an error or have questions about your account status, please contact our support team."
                  }
                </p>
                <Link href="/contact" className="btn-secondary inline-block">
                  Contact Support
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
