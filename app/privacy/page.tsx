import type { Metadata } from "next";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | Good Hemp Distro",
  description: "How Good Hemp Distro collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto card-glass p-8 space-y-6">
            <h1 className="text-4xl font-bold text-accent">Privacy Policy</h1>
            <p className="text-muted text-sm">Effective date: January 24, 2026</p>

            <div className="space-y-4 text-muted text-sm leading-relaxed">
              <p>
                Good Hemp Distro respects your privacy. This policy explains what data we collect,
                how we use it, and the choices you have about your information.
              </p>
              <h2 className="text-lg font-semibold text-white">Information we collect</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Account details such as name, email address, and profile information.</li>
                <li>Order and subscription activity, including transaction history.</li>
                <li>Usage data such as pages visited and feature interactions.</li>
              </ul>
              <h2 className="text-lg font-semibold text-white">How we use information</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Provide and improve marketplace services.</li>
                <li>Process orders, subscriptions, and customer support requests.</li>
                <li>Send service updates and policy notices.</li>
              </ul>
              <h2 className="text-lg font-semibold text-white">Your choices</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>You can update your profile information at any time.</li>
                <li>You may request data access or deletion by contacting support.</li>
              </ul>
              <h2 className="text-lg font-semibold text-white">Contact</h2>
              <p>
                For privacy questions, email support@goodhempdistro.com.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
