export default function RootLoading() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="h-10 w-64 rounded bg-[var(--surface)]/60" />
            <div className="h-4 w-full rounded bg-[var(--surface)]/40" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="card-glass p-6 space-y-3">
                  <div className="h-4 w-40 rounded bg-[var(--surface)]/60" />
                  <div className="h-3 w-full rounded bg-[var(--surface)]/40" />
                  <div className="h-3 w-3/4 rounded bg-[var(--surface)]/40" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
