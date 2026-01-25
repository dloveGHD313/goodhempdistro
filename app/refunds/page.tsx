import type { Metadata } from "next";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Refund Policy | Good Hemp Distro",
  description: "Refund and return policy for Good Hemp Distro orders.",
};

export default function RefundsPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto card-glass p-8 space-y-6">
            <h1 className="text-4xl font-bold text-accent">Refund Policy</h1>
            <p className="text-muted text-sm">Effective date: January 24, 2026</p>

            <div className="space-y-4 text-muted text-sm leading-relaxed">
              <p>
                Refund eligibility varies by vendor and product category. We recommend reviewing
                vendor-specific policies prior to purchase.
              </p>
              <h2 className="text-lg font-semibold text-white">General guidelines</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Refund requests must be submitted within 14 days of delivery.</li>
                <li>Consumable goods may be non-returnable once opened.</li>
                <li>Order disputes are handled with the vendor and Good Hemp Distro support.</li>
              </ul>
              <h2 className="text-lg font-semibold text-white">How to request a refund</h2>
              <p>
                Contact support@goodhempdistro.com with your order number and reason for the
                request. We will coordinate with the vendor and provide next steps.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
