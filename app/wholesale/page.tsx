import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { createSupabaseServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Wholesale Hemp Distribution | GoodHempDistro",
  description:
    "Bulk hemp products for retailers and brands. Verified COAs, competitive pricing, and dedicated account support through GoodHempDistro's wholesale program.",
};

async function submitInquiry(formData: FormData) {
  "use server";

  const business_name = String(formData.get("business_name") || "").trim();
  const contact_name = String(formData.get("contact_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const volume = String(formData.get("volume") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!business_name || !contact_name || !email || !category) {
    redirect("/wholesale?error=1");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("wholesale_inquiries").insert({
    business_name,
    contact_name,
    email,
    phone: phone || null,
    category,
    volume: volume || null,
    message: message || null,
  });

  if (error) {
    redirect("/wholesale?error=1");
  }

  redirect("/wholesale?submitted=1");
}

export default async function WholesalePage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const submitted = params.submitted === "1";
  const hasError = params.error === "1";

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="card-glass p-8 md:p-10">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-accent">
                Wholesale Hemp Distribution — Built for Retailers &amp; Brands
              </h1>
              <p className="text-muted text-lg">
                Access bulk pricing, verified COA products, and dedicated account support.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="surface-card p-6">
                <h2 className="text-xl font-semibold mb-2">📦 Bulk Pricing</h2>
                <p className="text-muted">Volume discounts across all product categories</p>
              </div>
              <div className="surface-card p-6">
                <h2 className="text-xl font-semibold mb-2">🧪 Verified COA Products</h2>
                <p className="text-muted">Every product comes with lab-verified documentation</p>
              </div>
              <div className="surface-card p-6">
                <h2 className="text-xl font-semibold mb-2">🤝 Dedicated Account Support</h2>
                <p className="text-muted">A real person manages your account from day one</p>
              </div>
            </div>

            <div className="surface-card p-8">
              <h2 className="text-2xl font-semibold mb-6">Wholesale Inquiry Form</h2>

              {submitted ? (
                <p className="text-accent font-semibold">
                  Thank you! Our wholesale team will be in touch within 24 hours.
                </p>
              ) : (
                <form action={submitInquiry} className="space-y-5">
                  {hasError && (
                    <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm" role="alert">
                      Submission failed. Please email us directly to reach our team.
                    </div>
                  )}

                  <div>
                    <label htmlFor="business_name" className="block text-sm font-medium text-muted mb-1">
                      Business Name
                    </label>
                    <input id="business_name" name="business_name" type="text" required className="input-shell w-full" />
                  </div>

                  <div>
                    <label htmlFor="contact_name" className="block text-sm font-medium text-muted mb-1">
                      Contact Name
                    </label>
                    <input id="contact_name" name="contact_name" type="text" required className="input-shell w-full" />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-muted mb-1">
                      Email
                    </label>
                    <input id="email" name="email" type="email" required className="input-shell w-full" />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-muted mb-1">
                      Phone
                    </label>
                    <input id="phone" name="phone" type="tel" className="input-shell w-full" />
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-muted mb-1">
                      Product Category Interest
                    </label>
                    <select id="category" name="category" required className="input-shell w-full">
                      <option value="">Select...</option>
                      <option value="Flower">Flower</option>
                      <option value="Edibles">Edibles</option>
                      <option value="Topicals">Topicals</option>
                      <option value="Concentrates">Concentrates</option>
                      <option value="All Categories">All Categories</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="volume" className="block text-sm font-medium text-muted mb-1">
                      Monthly Volume Estimate
                    </label>
                    <select id="volume" name="volume" className="input-shell w-full">
                      <option value="">Select...</option>
                      <option value="Under $5k">Under $5k</option>
                      <option value="$5k–$25k">$5k–$25k</option>
                      <option value="$25k–$100k">$25k–$100k</option>
                      <option value="$100k+">$100k+</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-muted mb-1">
                      Message
                    </label>
                    <textarea id="message" name="message" rows={4} className="input-shell w-full" />
                  </div>

                  <button type="submit" className="btn-primary">
                    Submit Inquiry
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
