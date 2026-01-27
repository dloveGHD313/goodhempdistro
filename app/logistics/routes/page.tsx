import Link from "next/link";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default function LogisticsRoutesPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="card-glass p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-muted mb-2">Delivery Matching</p>
              <h1 className="text-4xl font-bold text-accent mb-3">Route Preview</h1>
              <p className="text-muted">
                This preview shows how deliveries will be matched to verified drivers. Live route
                assignments will unlock in Phase 6.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link href="/logistics/dashboard" className="btn-secondary">
                  View logistics dashboard
                </Link>
                <Link href="/driver/dashboard" className="btn-primary">
                  Driver dashboard
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                {
                  title: "Route A · Downtown Loop",
                  detail: "3 stops · 12 mi · 45-60 min",
                  status: "Ready for dispatch",
                },
                {
                  title: "Route B · Westside Express",
                  detail: "2 stops · 8 mi · 30-40 min",
                  status: "Awaiting driver",
                },
              ].map((route) => (
                <div key={route.title} className="card-glass p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-semibold">{route.title}</h2>
                    <span className="info-pill">{route.status}</span>
                  </div>
                  <p className="text-muted mb-4">{route.detail}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="delivery-chip">🚚 Driver matched</span>
                    <span className="compliance-chip">✅ Compliance check</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="card-glass p-6">
              <h2 className="text-2xl font-semibold mb-3">Matching Rules (Preview)</h2>
              <div className="grid gap-3 text-muted">
                <div>• Prioritize drivers within 5 miles of pickup.</div>
                <div>• Require verified compliance status before assignment.</div>
                <div>• Balance load to keep delivery windows under 60 minutes.</div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
