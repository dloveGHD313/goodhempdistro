import Link from "next/link";

export default function GetStartedPage() {
  return (
    <main className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>Get Started</h1>
        <p className="text-gray-300 mb-8">Create an account to access the full community and marketplace.</p>
        <div className="flex gap-4">
          <Link href="/login" className="btn-primary">Login</Link>
          <Link href="/signup" className="btn-cta">Sign Up</Link>
        </div>
      </div>
    </main>
  );
}
