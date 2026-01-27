import Link from "next/link";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default function LogisticsDashboardPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="card-glass p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-muted mb-2">Logistics</p>
              <h1 className="text-4xl font-bold text-accent mb-3">Logistics Control Center</h1>
              <p className="text-muted">
                Manage delivery operations, review pending routes, and track driver capacity. This
                dashboard is the foundation for upcoming routing and dispatch tools.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link href="/logistics" className="btn-secondary">
                  Back to logistics
                </Link>
                <Link href="/logistics/routes" className="btn-primary">
                  Preview delivery matching
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "Active Routes", value: "0 live", detail: "Dispatch queue will appear here." },
                { title: "Driver Pool", value: "Foundations", detail: "Track approved drivers + availability." },
                { title: "Compliance Checks", value: "Ready", detail: "Age + COA enforcement stays visible." },
              ].map((card) => (
                <div key={card.title} className="card-glass p-6">
                  <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
                  <p className="text-2xl font-bold text-accent mb-2">{card.value}</p>
                  <p className="text-muted text-sm">{card.detail}</p>
                </div>
              ))}
            </div>

            <div className="card-glass p-6">
              <h2 className="text-2xl font-semibold mb-3">Next Steps</h2>
              <ul className="space-y-2 text-muted">
                <li>• Enable live route assignment and driver shift scheduling.</li>
                <li>• Add SLA tracking for delivery windows and compliance audits.</li>
                <li>• Surface marketplace heat maps for local fulfillment demand.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
