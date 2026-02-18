import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Checkout cancelled | Events",
  description: "Event ticket checkout was cancelled.",
};

export default function EventCheckoutCancelPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto text-center card-glass p-8">
            <h1 className="text-2xl font-bold mb-4 text-accent">Checkout cancelled</h1>
            <p className="text-muted mb-6">
              Your event ticket purchase was not completed. You can return to the event to try again.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/events" className="btn-primary">
                Back to Events
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
