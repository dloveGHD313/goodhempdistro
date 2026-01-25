import Link from "next/link";
import Footer from "@/components/Footer";

export default function GroupsPage() {
  const groups: Array<{ id: number; name: string; summary: string }> = [];

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="surface-card p-8">
              <h1 className="text-4xl font-bold mb-4 text-accent">Groups</h1>
              <p className="text-muted">
                Join interest-based groups to connect with vendors and consumers.
              </p>
            </div>

            {groups.length === 0 ? (
              <div className="card-glass p-8 text-center">
                <p className="text-muted">No groups available yet.</p>
                <p className="text-xs text-muted mt-2">
                  Group communities are launching soon.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {groups.map((group) => (
                  <div key={group.id} className="surface-card p-6">
                    <h2 className="text-lg font-semibold">{group.name}</h2>
                    <p className="text-muted mt-2">{group.summary}</p>
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
