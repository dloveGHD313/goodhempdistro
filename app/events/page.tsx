import Footer from "@/components/Footer";

export default function EventsPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto surface-card p-8">
            <h1 className="text-4xl font-bold mb-4 text-accent">Events</h1>
            <p className="text-muted mb-6">Discover upcoming events and workshops.</p>
            <div className="grid gap-4">
              {[1, 2].map((item) => (
                <div key={item} className="surface-card p-5">
                  <h3 className="text-lg font-semibold mb-2">Community Workshop</h3>
                  <p className="text-muted text-sm">Stay tuned for event dates and locations.</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
