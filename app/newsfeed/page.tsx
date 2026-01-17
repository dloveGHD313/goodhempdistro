import Link from "next/link";
import Footer from "@/components/Footer";

export default function NewsFeedPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-4 text-accent">Community News Feed</h1>
            <p className="text-muted mb-8">Preview of public posts. Sign in to see the full feed.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="surface-card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full border border-[var(--border)] bg-[var(--surface)]/60" />
                    <div>
                      <p className="font-semibold">Community Member</p>
                      <p className="text-muted text-sm">2h ago</p>
                    </div>
                  </div>
                  <p className="text-muted">Welcome to the Good Hemp Distro community! 🌿</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
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
