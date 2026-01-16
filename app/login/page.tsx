import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Good Hemp Distro",
  description: "Access your Good Hemp Distro account",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <h1 className="text-4xl font-bold mb-4">Login</h1>
        <p className="text-gray-300 mb-10">
          Sign in to access your dashboard and manage orders.
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 space-y-6">
          <p className="text-gray-300">
            Authentication UI is not configured in this demo. To proceed, use the dashboard link
            if you are already signed in, or return to the store to continue browsing.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/dashboard"
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg transition"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/products"
              className="border border-gray-600 text-white px-5 py-2 rounded-lg hover:border-green-500 hover:text-green-400 transition"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
