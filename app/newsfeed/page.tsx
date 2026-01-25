import Link from "next/link";
import Footer from "@/components/Footer";

export default function NewsFeedPage() {
  const posts: Array<{ id: number; title: string; excerpt: string }> = [];

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-4 text-accent">Community News Feed</h1>
            <p className="text-muted mb-8">
              Public highlights and updates from the Good Hemp Distro community.
            </p>

            {posts.length === 0 ? (
              <div className="card-glass p-8 text-center">
                <p className="text-muted">No public posts yet.</p>
                <p className="text-xs text-muted mt-2">
                  Community updates will appear here as soon as the feed launches.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {posts.map((post) => (
                  <div key={post.id} className="surface-card p-6">
                    <h2 className="text-lg font-semibold">{post.title}</h2>
                    <p className="text-muted mt-2">{post.excerpt}</p>
                  </div>
                ))}
              </div>
            )}

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
