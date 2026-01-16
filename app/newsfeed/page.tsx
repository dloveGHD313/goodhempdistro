import Link from "next/link";

export default function NewsFeedPage() {
  return (
    <main className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>Community News Feed</h1>
        <p className="text-gray-300 mb-8">Preview of public posts. Sign in to see full feed.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map((i) => (
            <div key={i} className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-700" />
                <div>
                  <p className="font-semibold">Community Member</p>
                  <p className="text-gray-500 text-sm">2h ago</p>
                </div>
              </div>
              <p className="text-gray-200">Welcome to the Good Hemp Distro community! 🌿</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex gap-4">
          <Link href="/login" className="btn-primary">Sign in</Link>
          <Link href="/get-started" className="btn-cta">Get Started</Link>
        </div>
      </div>
    </main>
  );
}
