import Link from "next/link";
import Nav from "@/components/Nav";

export default function Home() {
  return (
    <div className="min-h-screen text-white">

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16">
        <section className="text-center mb-12">
          <h2 className="text-5xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>
            Premium Hemp Products Marketplace
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Discover high-quality hemp-derived products from trusted vendors.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/get-started" className="btn-cta">
              Get Started
            </Link>
            <Link href="/products" className="btn-primary">
              Shop Now
            </Link>
            <Link
              href="/vendors"
              className="inline-block border border-green-600 text-green-400 hover:bg-green-700/30 font-bold py-3 px-8 rounded-lg transition"
            >
              Meet Vendors
            </Link>
            <Link href="/products" className="btn-primary">View Products</Link>
            <h3 className="text-xl font-bold mb-2">🔒 Secure Checkout</h3>
            <p className="text-slate-300">
              className="inline-block border border-[var(--accent-green)] text-[var(--accent-green)] hover:bg-green-700/30 font-bold py-3 px-8 rounded-lg transition"
            </p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <h3 className="text-xl font-bold mb-2">📦 Fast Shipping</h3>
            <p className="text-slate-300">
              Quick and discreet delivery to all 50 states.
            </p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
            <h3 className="text-xl font-bold mb-2">✅ Verified Products</h3>
            <p className="text-slate-300">
              All products tested and verified by third-party labs.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-16 bg-slate-700/30 rounded-lg p-8 border border-slate-600 text-center">
          <h3 className="text-2xl font-bold mb-4">Ready to explore?</h3>
          <p className="text-slate-300 mb-6">
            Browse our selection of premium hemp products.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/products"
              className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition"
            >
              View Products
            </Link>
            <Link
              href="/vendors"
              className="inline-block border border-green-600 text-green-400 hover:bg-green-700/30 font-bold py-3 px-8 rounded-lg transition"
            >
              Explore Vendors
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-16 py-8 text-center text-slate-400">
        <p>&copy; 2026 Good Hemp Distro. All rights reserved.</p>
      </footer>
    </div>
  );
}
