import Link from "next/link";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function VendorsActivatePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-16">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Choose a plan to activate your vendor account
          </h1>
          <p className="text-muted mb-6">
            Your vendor application has been received. To start selling, select a vendor plan and complete checkout. Your account will activate as soon as Stripe confirms your subscription.
          </p>
          <Link
            href="/pricing?tab=vendor"
            className="inline-block px-6 py-3 bg-accent text-white font-medium rounded-lg hover:opacity-90 transition"
          >
            View vendor plans
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
