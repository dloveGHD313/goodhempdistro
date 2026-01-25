import Footer from "@/components/Footer";

export default function BlogPage() {
  const posts: Array<{ id: number; title: string; excerpt: string }> = [];

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="surface-card p-8">
              <h1 className="text-4xl font-bold mb-4 text-accent">Blog</h1>
              <p className="text-muted">
                Latest articles, vendor spotlights, and marketplace updates.
              </p>
            </div>

            {posts.length === 0 ? (
              <div className="card-glass p-8 text-center">
                <p className="text-muted">No posts available yet.</p>
                <p className="text-xs text-muted mt-2">
                  New stories are being curated for launch.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {posts.map((post) => (
                  <div key={post.id} className="surface-card p-6">
                    <h2 className="text-lg font-semibold">{post.title}</h2>
                    <p className="text-muted mt-2">{post.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
