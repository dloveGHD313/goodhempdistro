import Link from "next/link";
import Footer from "@/components/Footer";

export default function OrderCancelPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto card-glass p-8 text-center space-y-4">
            <h1 className="text-4xl font-bold text-accent">Checkout Cancelled</h1>
            <p className="text-muted">
              Your checkout was cancelled. You can resume shopping or try again when you are ready.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/products" className="btn-primary">
                Continue Shopping
              </Link>
              <Link href="/pricing" className="btn-secondary">
                View Plans
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
