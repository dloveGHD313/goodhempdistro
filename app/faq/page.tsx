import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ | Good Hemp Distro",
  description: "Frequently asked questions about Good Hemp Distro",
};

const FAQS = [
  {
    q: "What is Good Hemp Distro?",
    a: "Good Hemp Distro is a community marketplace connecting hemp producers, vendors, and buyers across the supply chain.",
  },
  {
    q: "How do I become a vendor?",
    a: "Register via Vendor Registration and complete the verification process. Once approved, you can list products immediately.",
  },
  {
    q: "What products are listed on the marketplace?",
    a: "We support CBD wellness products, industrial hemp, hemp-based services, and recreational hemp where legally permitted.",
  },
  {
    q: "How does wholesale access work?",
    a: "Wholesale buyers can apply through the Wholesale section. Access is granted after identity and business verification.",
  },
  {
    q: "Who do I contact for support?",
    a: "Reach us through the Contact or Support pages. Our team typically responds within one business day.",
  },
];

export default function FaqPage() {
  return (
    <main className="min-h-screen">
      <section className="section-shell">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="card-glass p-8 space-y-4">
            <h1 className="text-3xl font-bold text-accent">Frequently Asked Questions</h1>
            <p className="text-muted">
              Answers to common questions about Good Hemp Distro.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="card-glass p-6 rounded-lg space-y-2">
                <div className="font-semibold">{q}</div>
                <div className="text-sm text-muted">{a}</div>
              </div>
            ))}
          </div>

          <div className="card-glass p-6 rounded-lg flex items-center justify-between">
            <div>
              <div className="font-semibold">Still have questions?</div>
              <div className="text-sm text-muted">Our support team is happy to help.</div>
            </div>
            <Link href="/contact" className="btn-secondary text-sm">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
