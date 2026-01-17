import Footer from "@/components/Footer";

export default function BlogPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto surface-card p-8">
            <h1 className="text-4xl font-bold mb-4 text-accent">Blog</h1>
            <p className="text-muted mb-6">Latest articles and insights from the hemp community.</p>
            <div className="surface-card p-5">
              <p className="text-muted">New posts are coming soon.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
