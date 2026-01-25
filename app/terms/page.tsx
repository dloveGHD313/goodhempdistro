import type { Metadata } from "next";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service | Good Hemp Distro",
  description: "Terms and conditions for using Good Hemp Distro.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto card-glass p-8 space-y-6">
            <h1 className="text-4xl font-bold text-accent">Terms of Service</h1>
            <p className="text-muted text-sm">Effective date: January 24, 2026</p>

            <div className="space-y-4 text-muted text-sm leading-relaxed">
              <p>
                By accessing Good Hemp Distro, you agree to these terms. If you do not agree,
                please do not use the platform.
              </p>
              <h2 className="text-lg font-semibold text-white">Marketplace rules</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Users must be 21+ to purchase regulated products.</li>
                <li>Vendors are responsible for product compliance and accuracy.</li>
                <li>Accounts may be suspended for policy or legal violations.</li>
              </ul>
              <h2 className="text-lg font-semibold text-white">Payments</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>All payments are processed through approved payment providers.</li>
                <li>Orders are confirmed once payment is authorized.</li>
              </ul>
              <h2 className="text-lg font-semibold text-white">Liability</h2>
              <p>
                Good Hemp Distro is a marketplace and is not responsible for vendor content,
                product misuse, or third-party actions beyond applicable law.
              </p>
              <h2 className="text-lg font-semibold text-white">Contact</h2>
              <p>
                Questions about these terms can be sent to support@goodhempdistro.com.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
