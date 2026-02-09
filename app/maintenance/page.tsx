export const dynamic = "force-static";

export default function MaintenancePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="max-w-lg mx-auto text-center px-4">
        <h1 className="text-4xl font-bold text-accent mb-4">We&apos;ll be right back</h1>
        <p className="text-lg text-muted mb-6">
          Maintenance is currently in progress. Most features are temporarily unavailable.
        </p>
        <p className="text-sm text-muted">
          If you&apos;re an administrator, sign in and navigate to <code>/admin</code> to access
          operational tools.
        </p>
      </div>
    </main>
  );
}

