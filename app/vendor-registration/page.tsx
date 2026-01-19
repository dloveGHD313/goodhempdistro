"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import VendorForm from "./VendorForm";

type Vendor = {
  id: string;
  business_name: string;
  status: string;
};

export default function VendorRegistrationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkVendor() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login?redirect=/vendor-registration");
          return;
        }

        // Check for vendor application first
        const { data: application } = await supabase
          .from("vendor_applications")
          .select("id, business_name, status")
          .eq("user_id", user.id)
          .single();

        if (application) {
          // Show application status
          setVendor({
            id: application.id,
            business_name: application.business_name,
            status: application.status === "approved" ? "active" : application.status,
          });
        } else {
          // Check for existing vendor
          const { data: vendorData } = await supabase
            .from("vendors")
            .select("id, business_name, status")
            .eq("owner_user_id", user.id)
            .single();

          if (vendorData) {
            setVendor(vendorData);
          } else {
            // Check URL params for pending status
            const params = new URLSearchParams(window.location.search);
            if (params.get("status") === "pending") {
              setMessage("Your vendor application has been submitted and is pending review.");
            }
            setShowForm(true);
          }
        }
      } catch (error) {
        console.error("Error checking vendor:", error);
        setShowForm(true);
      } finally {
        setLoading(false);
      }
    }

    checkVendor();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  // If vendor exists, show status and link to dashboard
  if (vendor) {
    const isPending = vendor.status === "pending";
    const isActive = vendor.status === "active";

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
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-yellow-400">
                  Your vendor application is pending review. You'll be notified once it's approved.
                </div>
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
  if (showForm) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            {message && (
              <div className="max-w-2xl mx-auto mb-6 bg-green-900/30 border border-green-600 rounded-lg p-4 text-green-400">
                {message}
              </div>
            )}
            <VendorForm />
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return null;
}
