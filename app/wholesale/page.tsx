import Link from "next/link";
import Footer from "@/components/Footer";

export default function WholesalePage() {
  const opportunities: Array<{ id: number; title: string; summary: string }> = [];

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="surface-card p-8">
              <h1 className="text-4xl font-bold mb-4 text-accent">Wholesale</h1>
              <p className="text-muted">
                Wholesale access for approved buyers and vetted vendors.
              </p>
            </div>

            {opportunities.length === 0 ? (
              <div className="card-glass p-8 text-center">
                <p className="text-muted">Wholesale listings are coming soon.</p>
                <p className="text-xs text-muted mt-2">
                  Apply for access now to receive launch notifications.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {opportunities.map((item) => (
                  <div key={item.id} className="surface-card p-6">
                    <h2 className="text-lg font-semibold">{item.title}</h2>
                    <p className="text-muted mt-2">{item.summary}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <Link href="/login" className="btn-primary">Sign in</Link>
              <Link href="/get-started" className="btn-secondary">Get Started</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
