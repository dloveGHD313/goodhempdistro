import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support | Good Hemp Distro",
  description: "Get help and support for Good Hemp Distro",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen">
      <section className="section-shell">
        <div className="max-w-2xl mx-auto card-glass p-8 space-y-6">
          <h1 className="text-3xl font-bold text-accent">Support</h1>
          <p className="text-muted">
            Need help? Browse resources below or reach our team directly.
          </p>

          <div className="space-y-4">
            <div className="card-glass p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-semibold">Contact Us</div>
                <div className="text-sm text-muted">Send a message to our support team</div>
              </div>
              <Link href="/contact" className="btn-secondary text-sm">
                Contact
              </Link>
            </div>

            <div className="card-glass p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-semibold">FAQ</div>
                <div className="text-sm text-muted">Frequently asked questions</div>
              </div>
              <Link href="/faq" className="btn-secondary text-sm">
                Browse
              </Link>
            </div>

            <div className="card-glass p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-semibold">Knowledge Base</div>
                <div className="text-sm text-muted">Guides and documentation — coming soon</div>
              </div>
              <span className="text-xs text-muted">Soon</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
