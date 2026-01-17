import Link from "next/link";
import Footer from "@/components/Footer";

export default function ForumsPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto surface-card p-8">
            <h1 className="text-4xl font-bold mb-4 text-accent">Forums</h1>
            <p className="text-muted mb-6">
              Discuss topics with peers. Sign in required for full access.
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
