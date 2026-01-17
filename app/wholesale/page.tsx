import Link from "next/link";
import Footer from "@/components/Footer";

export default function WholesalePage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto surface-card p-8">
            <h1 className="text-4xl font-bold mb-4 text-accent">Wholesale</h1>
            <p className="text-muted mb-6">
              Access to wholesale marketplace. Sign in and verify age to continue.
            </p>
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
