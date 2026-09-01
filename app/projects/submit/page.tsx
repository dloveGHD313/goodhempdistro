import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  HONEYPOT_FIELD,
  FORM_TS_FIELD,
  formSpamCheck,
} from "@/lib/server/antiSpam";
import {
  PROJECT_CATEGORY_OPTIONS,
  matchVendors,
  validateProjectSubmission,
  type MatchableVendor,
} from "@/lib/server/projectMatching";
import { sendProjectSubmissionEmails } from "@/lib/server/projectSubmissionEmails";
import FormSpamGuardFields from "@/components/FormSpamGuardFields";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Submit a Hemp Project | Good Hemp Distro",
  description:
    "Contractors, developers, and builders: submit your hemp building project and we'll route it to the vendors whose materials and services match — hempcrete, hurd, binders, insulation, and more.",
  openGraph: {
    title: "Submit a Hemp Project | Good Hemp Distro",
    description:
      "Submit your hemp building project and get matched with vendors for hempcrete, hurd, lime binder, insulation, blocks, and more.",
    url: `${brand.url}/projects/submit`,
    siteName: brand.name,
    type: "website",
  },
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
  "WI","WY","DC",
] as const;

async function submitProject(formData: FormData) {
  "use server";

  const str = (k: string) => ((formData.get(k) as string) || "").trim();
  const contact_name = str("contact_name");
  const company = str("company") || null;
  const email = str("email");
  const phone = str("phone") || null;
  const submitter_role = str("submitter_role") || "other";
  const project_type = str("project_type");
  const state = str("state").toUpperCase();
  const city = str("city") || null;
  const timeline = str("timeline") || null;
  const budget_range = str("budget_range") || null;
  const description = str("description");
  const categories = PROJECT_CATEGORY_OPTIONS.map((o) => o.id).filter(
    (id) => formData.get(`cat_${id}`) === "on"
  );

  const invalid = validateProjectSubmission({
    contact_name,
    email,
    state,
    project_type,
    description,
    categories,
  });
  if (invalid) {
    redirect("/projects/submit?error=1");
  }

  // Bot/spam gate: honeypot + minimum fill time + email verdict.
  const spamReason = formSpamCheck({
    honeypot: formData.get(HONEYPOT_FIELD),
    formTs: formData.get(FORM_TS_FIELD),
    email,
  });
  if (spamReason) {
    console.warn("[project-submit] blocked submission:", spamReason);
    // Generic success so bots learn nothing.
    redirect("/projects/submit?submitted=1");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const admin = getSupabaseAdminClient();

  // Rate limit: block a second submission from the same email within 60s.
  try {
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await admin
      .from("project_submissions")
      .select("*", { count: "exact", head: true })
      .ilike("email", email)
      .gte("created_at", sixtySecondsAgo);
    if (recentCount && recentCount > 0) {
      redirect("/projects/submit?error=1");
    }
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[project-submit] rate-limit check failed:", err);
  }

  // Insert via the admin client so we can read back the row id — the public
  // role has INSERT but (deliberately) no SELECT on this table.
  const { data: inserted, error } = await admin
    .from("project_submissions")
    .insert({
      contact_name,
      company,
      email,
      phone,
      submitter_role,
      project_type,
      state,
      city,
      timeline,
      budget_range,
      description,
      categories,
      created_by: user?.id ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[project-submit] insert error:", error.message);
    redirect("/projects/submit?error=1");
  }

  // Match active, approved vendors — best-effort; failures never break submit.
  try {
    const { data: vendors } = await admin
      .from("vendors")
      .select(
        "id, business_name, contact_email, state, service_areas, categories, tags, description"
      )
      .eq("status", "active")
      .eq("is_approved", true);

    const matches = matchVendors((vendors ?? []) as MatchableVendor[], {
      state,
      categories,
    });

    if (inserted?.id) {
      await admin
        .from("project_submissions")
        .update({
          matched_vendor_ids: matches.map((m) => m.vendor.id),
          status: matches.length > 0 ? "matched" : "new",
        })
        .eq("id", inserted.id);
    }

    await sendProjectSubmissionEmails(
      {
        contact_name,
        company,
        email,
        phone,
        submitter_role,
        project_type,
        state,
        city,
        timeline,
        budget_range,
        description,
        categories,
      },
      matches
    );
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[project-submit] matching/notify failed:", err);
  }

  redirect("/projects/submit?submitted=1");
}

export default async function SubmitProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const submitted = params?.submitted === "1";
  const hasError = params?.error === "1";

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell max-w-3xl mx-auto pt-10 pb-16">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-accent mb-3">
              Submit a Hemp Project
            </h1>
            <p className="text-muted max-w-2xl mx-auto">
              Building with hemp? Tell us about the project and we&apos;ll route it to the
              vendors whose materials and services match — hempcrete installers, hurd and
              binder suppliers, insulation makers, and more.
            </p>
          </div>

          {submitted ? (
            <div className="card-glass p-8 text-center">
              <div className="text-4xl mb-3">✅</div>
              <h2 className="text-xl font-bold mb-2">Project received</h2>
              <p className="text-muted mb-6">
                We&apos;ve routed your project to matching vendors. Expect to hear from them
                (or from our team) soon.
              </p>
              <Link href="/products" className="btn-secondary inline-block py-3 px-8">
                Browse hemp products
              </Link>
            </div>
          ) : (
            <div className="card-glass p-6 md:p-8">
              <form action={submitProject} className="space-y-5">
                <FormSpamGuardFields />
                {hasError && (
                  <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm" role="alert">
                    Something went wrong — please check the required fields and try again.
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact_name" className="block text-sm font-medium text-muted mb-1">
                      Your Name <span className="text-red-400">*</span>
                    </label>
                    <input id="contact_name" name="contact_name" type="text" required className="input-shell w-full" />
                  </div>
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-muted mb-1">
                      Company <span className="text-gray-600">(optional)</span>
                    </label>
                    <input id="company" name="company" type="text" className="input-shell w-full" />
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

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="submitter_role" className="block text-sm font-medium text-muted mb-1">
                      I am a... <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="submitter_role"
                      name="submitter_role"
                      required
                      className="input-shell w-full"
                      style={{ backgroundColor: "var(--surface, #141F1A)", color: "var(--foreground, #F0EDE6)" }}
                    >
                      <option value="">Select your role</option>
                      <option value="contractor">General Contractor</option>
                      <option value="developer">Developer</option>
                      <option value="architect">Architect / Designer</option>
                      <option value="builder">Builder / Installer</option>
                      <option value="homeowner">Homeowner</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="project_type" className="block text-sm font-medium text-muted mb-1">
                      Project type <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="project_type"
                      name="project_type"
                      required
                      className="input-shell w-full"
                      style={{ backgroundColor: "var(--surface, #141F1A)", color: "var(--foreground, #F0EDE6)" }}
                    >
                      <option value="">Select project type</option>
                      <option value="new_build_residential">New build — residential</option>
                      <option value="new_build_commercial">New build — commercial</option>
                      <option value="retrofit_insulation">Retrofit / insulation</option>
                      <option value="adu_tiny_home">ADU / tiny home</option>
                      <option value="materials_supply_only">Materials supply only</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-muted mb-1">
                      State <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="state"
                      name="state"
                      required
                      className="input-shell w-full"
                      style={{ backgroundColor: "var(--surface, #141F1A)", color: "var(--foreground, #F0EDE6)" }}
                    >
                      <option value="">State</option>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-muted mb-1">
                      City <span className="text-gray-600">(optional)</span>
                    </label>
                    <input id="city" name="city" type="text" className="input-shell w-full" />
                  </div>
                  <div>
                    <label htmlFor="timeline" className="block text-sm font-medium text-muted mb-1">
                      Timeline <span className="text-gray-600">(optional)</span>
                    </label>
                    <select
                      id="timeline"
                      name="timeline"
                      className="input-shell w-full"
                      style={{ backgroundColor: "var(--surface, #141F1A)", color: "var(--foreground, #F0EDE6)" }}
                    >
                      <option value="">Timeline</option>
                      <option value="0-3 months">0–3 months</option>
                      <option value="3-6 months">3–6 months</option>
                      <option value="6-12 months">6–12 months</option>
                      <option value="exploring">Just exploring</option>
                    </select>
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-medium text-muted mb-2">
                    What do you need? <span className="text-red-400">*</span>
                  </span>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {PROJECT_CATEGORY_OPTIONS.map((opt) => (
                      <label key={opt.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`cat_${opt.id}`} className="accent-[var(--brand-lime)]" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="budget_range" className="block text-sm font-medium text-muted mb-1">
                    Budget range <span className="text-gray-600">(optional)</span>
                  </label>
                  <select
                    id="budget_range"
                    name="budget_range"
                    className="input-shell w-full"
                    style={{ backgroundColor: "var(--surface, #141F1A)", color: "var(--foreground, #F0EDE6)" }}
                  >
                    <option value="">Prefer not to say</option>
                    <option value="under_25k">Under $25k</option>
                    <option value="25k_100k">$25k–$100k</option>
                    <option value="100k_500k">$100k–$500k</option>
                    <option value="500k_plus">$500k+</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-muted mb-1">
                    Project description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    required
                    minLength={20}
                    rows={5}
                    className="input-shell w-full"
                    placeholder="What are you building, roughly how big, and what hemp materials or services do you need?"
                  />
                </div>

                <button type="submit" className="btn-primary w-full py-3 font-bold">
                  Submit project
                </button>
                <p className="text-xs text-muted text-center">
                  We share your contact details only with the vendors matched to this project.
                </p>
              </form>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
