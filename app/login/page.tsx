import Link from "next/link";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Good Hemp Distro",
  description: "Access your Good Hemp Distro account",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto surface-card p-8 space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-4 text-accent">Login</h1>
              <p className="text-muted">
                Sign in to access your dashboard and manage orders.
              </p>
            </div>
            <p className="text-muted">
              Authentication UI is not configured in this demo. To proceed, use the dashboard link
              if you are already signed in, or return to the store to continue browsing.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/dashboard" className="btn-primary">
                Go to Dashboard
              </Link>
              <Link href="/products" className="btn-secondary">
                Browse Products
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
