import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Feature on Learning with Jax | Good Hemp Distro",
  description:
    "Apply to be featured on Learning with Jax. Share your hemp industry expertise with thousands of vendors and consumers.",
  openGraph: {
    title: "Feature on Learning with Jax | Good Hemp Distro",
    description:
      "Apply to be featured on Learning with Jax. Share your hemp industry expertise with thousands of vendors and consumers.",
    url: `${brand.url}/learning/jax`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Feature on Learning with Jax | Good Hemp Distro",
    description:
      "Apply to be featured on Learning with Jax. Share your hemp industry expertise with thousands of vendors and consumers.",
  },
};

async function submitJaxApplication(formData: FormData) {
  "use server";

  const name = formData.get("name") as string;
  const business_name = formData.get("business_name") as string;
  const email = formData.get("email") as string;
  const phone = (formData.get("phone") as string) || null;
  const website_url = (formData.get("website_url") as string) || null;
  const instagram_handle = (formData.get("instagram_handle") as string) || null;
  const tiktok_handle = (formData.get("tiktok_handle") as string) || null;
  const vendor_type = formData.get("vendor_type") as string;
  const why_featured = formData.get("why_featured") as string;

  if (!name || !business_name || !email || !vendor_type || !why_featured) {
    redirect("/learning/jax?error=1");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const { error } = await supabase.from("jax_feature_applications").insert({
    name,
    business_name,
    email,
    phone,
    website_url,
    instagram_handle,
    tiktok_handle,
    vendor_type,
    why_featured,
    user_id: user?.id ?? null,
  });

  if (error) {
    console.error("[jax-feature-form] insert error:", error.message);
    redirect("/learning/jax?error=1");
  }

  redirect("/learning/jax?submitted=1");
}

export default async function JaxFeaturePage({
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
        {/* Hero */}
        <section className="welcome-hero py-10 px-4 futuristic-glow">
          <div className="max-w-3xl mx-auto text-center py-12">
            <Link
              href="/learning-with-jax"
              className="text-xs uppercase tracking-widest text-accent hover:underline mb-6 inline-block"
            >
              ← Back to Learning with Jax
            </Link>
            <p className="text-xs uppercase tracking-[0.35em] text-accent mb-4">Apply</p>
            <h1 className="hero-title text-accent mb-4">Feature on Learning with Jax</h1>
            <p className="hero-subtitle max-w-2xl mx-auto">
              Share your expertise with the hemp community. Apply to appear in an upcoming episode covering
              compliance, business growth, product knowledge, and industry insight.
            </p>
          </div>
        </section>

        <section className="section-shell">
          <div className="max-w-2xl mx-auto">
            {/* What to expect */}
            <div className="grid md:grid-cols-3 gap-4 mb-10">
              {[
                { icon: "🎙️", title: "30–60 min episode", desc: "Recorded remotely or in-studio" },
                { icon: "📣", title: "Reach thousands", desc: "Distributed to GHD vendors and consumers" },
                { icon: "✅", title: "Industry vetted", desc: "All guests are reviewed by our team" },
              ].map((item) => (
                <div key={item.title} className="surface-glass rounded-xl p-5 text-center border border-white/10">
                  <p className="text-2xl mb-2">{item.icon}</p>
                  <p className="font-semibold text-white text-sm">{item.title}</p>
                  <p className="text-xs text-muted mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Form card */}
            <div className="surface-card p-8">
              <h2 className="text-2xl font-semibold mb-6">Application Form</h2>

              {submitted ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-4">🎉</p>
                  <h3 className="text-xl font-semibold text-accent mb-3">Application received!</h3>
                  <p className="text-muted max-w-md mx-auto mb-6">
                    Thank you for applying. Our team reviews every application and will reach out within 5–7 business
                    days if you are a good fit.
                  </p>
                  <Link href="/learning-with-jax" className="btn-primary inline-block">
                    Back to Learning with Jax →
                  </Link>
                </div>
              ) : (
                <form action={submitJaxApplication} className="space-y-5">
                  {hasError && (
                    <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm" role="alert">
                      Something went wrong. Please try again or contact us directly.
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-muted mb-1">
                        Your Name <span className="text-red-400">*</span>
                      </label>
                      <input id="name" name="name" type="text" required className="input-shell w-full" />
                    </div>
                    <div>
                      <label htmlFor="business_name" className="block text-sm font-medium text-muted mb-1">
                        Business Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="business_name"
                        name="business_name"
                        type="text"
                        required
                        className="input-shell w-full"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-muted mb-1">
                        Email <span className="text-red-400">*</span>
                      </label>
                      <input id="email" name="email" type="email" required className="input-shell w-full" />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-muted mb-1">
                        Phone <span className="text-gray-600">(optional)</span>
                      </label>
                      <input id="phone" name="phone" type="tel" className="input-shell w-full" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="vendor_type" className="block text-sm font-medium text-muted mb-1">
                      I am a... <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="vendor_type"
                      name="vendor_type"
                      required
                      className="input-shell w-full"
                      style={{ backgroundColor: "var(--surface, #141F1A)", color: "var(--foreground, #F0EDE6)" }}
                    >
                      <option value="">Select your role</option>
                      <option value="grower">Hemp Grower / Farmer</option>
                      <option value="processor">Processor / Manufacturer</option>
                      <option value="retailer">Retailer / Dispensary</option>
                      <option value="brand">Brand / Product Company</option>
                      <option value="service_provider">Service Provider (Legal, Banking, Insurance, etc.)</option>
                      <option value="educator">Industry Educator / Consultant</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="why_featured" className="block text-sm font-medium text-muted mb-1">
                      Why do you want to be featured? <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      id="why_featured"
                      name="why_featured"
                      required
                      rows={5}
                      className="input-shell w-full resize-none"
                      placeholder="Tell us about your expertise and what you would share with the hemp community..."
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted mb-3">
                      Social & Web <span className="text-gray-600">(optional)</span>
                    </p>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="website_url" className="block text-xs text-muted mb-1">
                          Website
                        </label>
                        <input
                          id="website_url"
                          name="website_url"
                          type="url"
                          className="input-shell w-full"
                          placeholder="https://"
                        />
                      </div>
                      <div>
                        <label htmlFor="instagram_handle" className="block text-xs text-muted mb-1">
                          Instagram
                        </label>
                        <input
                          id="instagram_handle"
                          name="instagram_handle"
                          type="text"
                          className="input-shell w-full"
                          placeholder="@handle"
                        />
                      </div>
                      <div>
                        <label htmlFor="tiktok_handle" className="block text-xs text-muted mb-1">
                          TikTok
                        </label>
                        <input
                          id="tiktok_handle"
                          name="tiktok_handle"
                          type="text"
                          className="input-shell w-full"
                          placeholder="@handle"
                        />
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="w-full btn-primary">
                    Submit Application →
                  </button>

                  <p className="text-xs text-muted text-center">
                    We review every application personally. You will hear back within 5–7 business days if selected.
                  </p>
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
