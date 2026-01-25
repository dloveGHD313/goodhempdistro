import Link from "next/link";
import Footer from "@/components/Footer";

export default function AccountAddressesPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto card-glass p-8 space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-accent">Saved Addresses</h1>
              <p className="text-muted mt-2">
                Manage shipping and billing addresses for a faster checkout.
              </p>
            </div>

            <div className="bg-[var(--surface)]/60 border border-[var(--border)] rounded-lg p-6 text-center">
              <p className="text-muted">No saved addresses yet.</p>
              <p className="text-xs text-muted mt-2">
                Add an address during your next checkout and it will appear here.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/account" className="btn-secondary">
                Back to account
              </Link>
              <Link href="/products" className="btn-primary">
                Browse products
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
