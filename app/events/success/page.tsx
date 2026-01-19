import Link from "next/link";
import Footer from "@/components/Footer";

export default function EventSuccessPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto text-center card-glass p-8">
            <h1 className="text-4xl font-bold mb-4 text-green-400">🎉 Tickets Purchased!</h1>
            <p className="text-muted mb-6">
              Your tickets have been successfully purchased. You will receive a confirmation email shortly.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/events" className="btn-primary">
                Browse More Events
              </Link>
              <Link href="/dashboard" className="btn-secondary">
                Go to Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
