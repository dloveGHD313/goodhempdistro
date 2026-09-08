import Link from "next/link";
import Footer from "@/components/Footer";
import { createSupabaseServerClient } from "@/lib/supabase";

type ServiceRow = {
  id: string;
  title: string;
  description: string | null;
  vendor_id: string | null;
};

export default async function ServiceCategoryPage({ title, description, slug }: { title: string; description: string; slug: string }) {
  const supabase = await createSupabaseServerClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  let services: ServiceRow[] = [];
  if (category?.id) {
    const { data } = await supabase
      .from("services")
      .select("id, title, description, vendor_id")
      .eq("category_id", category.id)
      .eq("status", "approved")
      .eq("active", true)
      .limit(20);
    services = (data as ServiceRow[] | null) ?? [];
  }

  return (
    <>
      <main className="min-h-screen">
        <section className="section-shell">
          <div className="mx-auto max-w-5xl space-y-10">
            <header>
              <p className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">Services directory</p>
              <h1 className="mb-4 font-serif text-4xl md:text-5xl">{title}</h1>
              <p className="max-w-2xl text-muted">{description}</p>
            </header>
            <section>
              <h2 className="mb-4 font-serif text-2xl md:text-3xl">Listed providers</h2>
              {services.length === 0 ? (
                <div className="surface-card p-6 text-muted">
                  No providers listed in this category yet — founding providers are onboarding now.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {services.map((d) => (
                    <article key={d.id} className="surface-card p-5">
                      <h3 className="mb-2 text-xl font-semibold">{d.title}</h3>
                      <p className="mb-3 text-muted">{d.description || "No description provided."}</p>
                      <Link href={`/services/${d.id}`} className="text-accent underline-offset-4 hover:underline">
                        View service →
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section className="surface-card surface-card--raised p-6">
              <h3 className="mb-2 font-serif text-2xl">List your services</h3>
              <p className="mb-4 text-muted">Put your offer where builders, vendors and buyers are already looking.</p>
              <Link className="btn-primary inline-block" href={`/vendor-registration?category=${slug}`}>
                List your services
              </Link>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
