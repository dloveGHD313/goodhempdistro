import Link from "next/link";
import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isSafeNextPath } from "@/lib/phase2-workout-flow";
import Footer from "@/components/Footer";
import { HeroShell } from "@/components/ui/HeroShell";
import { FeatureSection } from "@/components/ui/FeatureSection";
import ServicesList from "./ServicesList";
import MarketSwitcher from "@/components/market/MarketSwitcher";
import { Reveal, Section, Stagger, StaggerChild, HoverLift } from "@/components/motion";

export const metadata: Metadata = {
  title: "Services | Good Hemp Distro",
  description: "Find help in the hemp industry — logistics, compliance, marketing, construction, processing.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SERVICE_CATEGORIES = [
  { id: "logistics", label: "Logistics", description: "Delivery, fulfillment, and supply chain." },
  { id: "compliance", label: "Compliance", description: "Testing, COA, and regulatory support." },
  { id: "marketing", label: "Marketing", description: "Branding, ads, and growth." },
  { id: "construction", label: "Construction", description: "Hemp construction and building." },
  { id: "processing", label: "Processing", description: "Extraction and manufacturing." },
] as const;

type Service = {
  id: string;
  title: string;
  description?: string;
  pricing?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
};

async function getServices(
  vendorId?: string | null
): Promise<{ services: Service[]; errorMessage?: string; vendorName?: string | null }> {
  try {
    noStore();
    const supabase = await createSupabaseServerClient();
    let vendorName: string | null = null;
    if (vendorId) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, business_name")
        .eq("id", vendorId)
        .eq("is_active", true)
        .eq("is_approved", true)
        .maybeSingle();

      if (!vendor) {
        return { services: [], vendorName: null };
      }
      vendorName = vendor.business_name;
    }

    const baseQuery = supabase
      .from("services")
      .select("id, title, description, pricing:pricing_type, created_at, updated_at, status")
      .eq("status", "approved")
      .eq("active", true)
      .order("updated_at", { ascending: false });

    const { data, error } = vendorId
      ? await baseQuery.eq("vendor_id", vendorId)
      : await baseQuery;

    if (error) {
      console.error("[services] Error fetching services:", error);
      return { services: [], errorMessage: "Unable to load services right now.", vendorName };
    }

    return { services: (data || []) as Service[], vendorName };
  } catch (err) {
    console.error("[services] Fatal error fetching services:", err);
    return { services: [], errorMessage: "Unable to load services right now." };
  }
}

function getBecomeServiceProviderHref(): string {
  const nextPath = "/vendor-registration";
  const base = "/signup";
  if (isSafeNextPath(nextPath)) {
    return `${base}?next=${encodeURIComponent(nextPath)}&role=vendor`;
  }
  return `${base}?role=vendor`;
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams?: { vendor?: string };
}) {
  const vendorId = searchParams?.vendor || null;
  const { services, errorMessage, vendorName } = await getServices(vendorId);
  const becomeProviderHref = getBecomeServiceProviderHref();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="welcome-hero py-10 px-4 futuristic-glow">
          <HeroShell cinematic glassPanel={false} contentClassName="max-w-3xl">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.35em] text-muted mb-2">Directory</p>
              <h1 className="hero-title text-accent mb-2">Services</h1>
              <p className="hero-subtitle">
                Find help in the hemp industry — logistics, compliance, marketing, construction, and more.
              </p>
            </Reveal>
          </HeroShell>
        </section>

        <FeatureSection
          eyebrow="Categories"
          title="Explore by category"
          description="Browse available categories; listings are linked as they’re added."
          contentClassName="px-4"
          gradient
        >
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_CATEGORIES.map((cat) => (
              <StaggerChild key={cat.id}>
                <HoverLift as="div" className="surface-glass rounded-[var(--radius-xl)] p-6 border border-[var(--border)]">
                  <h3 className="text-lg font-semibold text-foreground mb-2">{cat.label}</h3>
                  <p className="text-muted text-sm">{cat.description}</p>
                </HoverLift>
              </StaggerChild>
            ))}
          </Stagger>
          <div className="surface-glass rounded-[var(--radius-xl)] p-6 sm:p-8 mt-8 max-w-2xl">
            <h3 className="text-lg font-semibold text-foreground mb-2">Become a Service Provider</h3>
            <p className="text-muted text-sm mb-4">
              Offer services, get leads, and grow your business. Sign up as a vendor to list your services.
            </p>
            <HoverLift as="span">
              <Link href={becomeProviderHref} className="btn-primary inline-block">
                Become a Service Provider
              </Link>
            </HoverLift>
          </div>
        </FeatureSection>

        <Section className="section-shell">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-3 text-accent">
                {vendorName ? `Services from ${vendorName}` : "Listed services"}
              </h2>
              <p className="text-muted">
                {vendorName
                  ? "Explore approved services from this vendor."
                  : "Approved services from vendors on the platform."}
              </p>
            </div>
            <MarketSwitcher />
          </div>

          {errorMessage && (
            <div className="card-glass p-4 mb-6 border border-red-500/40 text-red-300">
              {errorMessage}
            </div>
          )}

          <ServicesList initialServices={services} />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
