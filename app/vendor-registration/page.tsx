import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasVendorContext } from "@/lib/authz";
import Footer from "@/components/Footer";
import VendorForm from "./VendorForm";

export const dynamic = 'force-dynamic';

type Vendor = {
  id: string;
  business_name: string;
  status: string;
};

async function getVendorData(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Check for vendor application first - MUST be scoped to user_id
    const { data: application, error: appError } = await supabase
      .from("vendor_applications")
      .select("id, user_id, business_name, status, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (appError) {
      console.error("[vendor-registration] Error fetching application:", appError);
      return null;
    }

    // DEFENSIVE: Verify the application belongs to this user
    if (application && application.user_id !== userId) {
      console.error("[vendor-registration] SECURITY: Application user_id mismatch!", {
        userId,
        application_user_id: application.user_id,
      });
      return null;
    }

    if (application) {
      return {
        id: application.id,
        business_name: application.business_name,
        status: application.status === "approved" ? "active" : application.status,
        created_at: application.created_at,
      };
    }

    // Check for existing vendor - MUST be scoped to owner_user_id
    const { data: vendorData, error: vendorError } = await supabase
      .from("vendors")
      .select("id, owner_user_id, business_name, status, created_at")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (vendorError) {
      console.error("[vendor-registration] Error fetching vendor:", vendorError);
      return null;
    }

    // DEFENSIVE: Verify the vendor belongs to this user
    if (vendorData && vendorData.owner_user_id !== userId) {
      console.error("[vendor-registration] SECURITY: Vendor owner_user_id mismatch!", {
        userId,
        vendor_owner_user_id: vendorData.owner_user_id,
      });
      return null;
    }

    if (vendorData) {
      return {
        id: vendorData.id,
        business_name: vendorData.business_name,
        status: vendorData.status,
        created_at: vendorData.created_at,
      };
    }

    return null;
  } catch (error) {
    console.error("[vendor-registration] Error in getVendorData:", error);
    return null;
  }
}

export default async function VendorRegistrationPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendor-registration");
  }

  // Fetch vendor data server-side with proper scoping
  const vendor = await getVendorData(user.id);
  
  // Log vendor context for debugging (server-only)
  const { _debug } = await hasVendorContext(supabase, user.id);
  if (_debug && !vendor) {
    console.log(`[vendor-registration] No vendor data found - ${JSON.stringify(_debug)}`);
  }

  // If vendor exists, show status page
  if (vendor) {
    const isPending = vendor.status === "pending";
    const isActive = vendor.status === "active";
    const isRejected = vendor.status === "rejected";

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
            <div className="max-w-2xl mx-auto surface-card p-8 text-center space-y-6">
              <h1 className="text-4xl font-bold mb-4 text-accent">Vendor Account</h1>
              <div>
                <p className="text-muted mb-2">Business Name</p>
                <p className="text-xl font-semibold">{vendor.business_name}</p>
              </div>
              <div>
                <p className="text-muted mb-2">Status</p>
                <span className={`px-3 py-1 rounded ${
                  isActive
                    ? "bg-green-900/30 text-green-400" 
                    : isPending
                    ? "bg-yellow-900/30 text-yellow-400"
                    : "bg-red-900/30 text-red-400"
                }`}>
                  {vendor.status}
                </span>
              </div>
              {isPending && (
                <>
                  <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-yellow-400">
                    Your vendor application is pending review. We'll notify you once it's been processed.
                    {submissionDate !== "N/A" && (
                      <p className="text-sm mt-2">Submitted on {submissionDate}</p>
                    )}
                  </div>
                  <div className="pt-4">
                    <Link href="/vendors/dashboard" className="btn-primary inline-block">
                      Go to Vendor Dashboard
                    </Link>
                  </div>
                </>
              )}
              {isRejected && (
                <>
                  <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
                    Your vendor application was not approved. Please contact support if you have questions.
                  </div>
                  <div className="pt-4">
                    <Link href="/vendors/dashboard" className="btn-primary inline-block">
                      Go to Vendor Dashboard
                    </Link>
                  </div>
                </>
              )}
              {isActive && (
                <div className="pt-4">
                  <Link href="/vendors/dashboard" className="btn-primary inline-block">
                    Go to Vendor Dashboard
                  </Link>
                </div>
              )}
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  // Show vendor creation form
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <VendorForm />
        </section>
      </main>
      <Footer />
    </div>
  );
}
