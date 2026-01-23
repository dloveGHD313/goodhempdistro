import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VendorDashboardProfilePage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/dashboard/profile");
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select(
      "id, business_name, vendor_type, description, contact_email, contact_phone, website, state, city, service_areas, categories, tags, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at"
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!vendor) {
    redirect("/vendor-registration");
  }

  if (!vendor.vendor_onboarding_completed || !vendor.terms_accepted_at || !vendor.compliance_acknowledged_at) {
    redirect("/onboarding/vendor");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold text-accent">Vendor Profile</h1>
            <Link href="/onboarding/vendor" className="btn-secondary">
              Edit profile
            </Link>
          </div>

          <div className="surface-card p-6 space-y-4">
            <div>
              <div className="text-sm text-muted">Business name</div>
              <div className="text-xl font-semibold">{vendor.business_name}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted">
              <div>
                <div className="text-xs uppercase tracking-wide">Vendor type</div>
                <div className="text-white text-base">
                  {vendor.vendor_type ? vendor.vendor_type.replace(/_/g, " ") : "Not set"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide">Location</div>
                <div className="text-white text-base">
                  {[vendor.city, vendor.state].filter(Boolean).join(", ") || "Not set"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide">Contact email</div>
                <div className="text-white text-base">{vendor.contact_email || "Not set"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide">Contact phone</div>
                <div className="text-white text-base">{vendor.contact_phone || "Not set"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide">Website</div>
                <div className="text-white text-base">{vendor.website || "Not set"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide">Service areas</div>
                <div className="text-white text-base">
                  {(vendor.service_areas || []).join(", ") || "Not set"}
                </div>
              </div>
            </div>
            {(vendor.categories?.length || vendor.tags?.length) && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted mb-2">Categories & tags</div>
                <div className="flex flex-wrap gap-2">
                  {[...(vendor.categories || []), ...(vendor.tags || [])].map((tag: string) => (
                    <span
                      key={tag}
                      className="bg-[var(--brand-lime)]/15 text-[var(--brand-lime)] px-3 py-1 rounded text-sm border border-[var(--brand-lime)]/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
