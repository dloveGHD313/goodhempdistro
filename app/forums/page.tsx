import Link from "next/link";
import Footer from "@/components/Footer";

export default function ForumsPage() {
  const topics: Array<{ id: number; title: string; description: string }> = [];

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="surface-card p-8">
              <h1 className="text-4xl font-bold mb-4 text-accent">Forums</h1>
              <p className="text-muted">
                Ask questions, share insights, and learn from the community.
              </p>
            </div>

            {topics.length === 0 ? (
              <div className="card-glass p-8 text-center">
                <p className="text-muted">No forum topics yet.</p>
                <p className="text-xs text-muted mt-2">
                  Discussion boards are coming soon.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {topics.map((topic) => (
                  <div key={topic.id} className="surface-card p-6">
                    <h2 className="text-lg font-semibold">{topic.title}</h2>
                    <p className="text-muted mt-2">{topic.description}</p>
                  </div>
                ))}
              </div>
            )}

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
