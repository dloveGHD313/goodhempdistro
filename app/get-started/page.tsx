import Link from "next/link";
import Footer from "@/components/Footer";

export default function GetStartedPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto surface-card p-8 text-center">
            <h1 className="text-4xl font-bold mb-4 text-accent">Get Started</h1>
            <p className="text-muted mb-8">Create an account to access the full community and marketplace.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login" className="btn-secondary">Login</Link>
              <Link href="/signup" className="btn-primary">Sign Up</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
