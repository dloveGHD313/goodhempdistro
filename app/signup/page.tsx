import Link from "next/link";
import Footer from "@/components/Footer";

export default function SignupPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto surface-card p-8 text-center">
            <h1 className="text-4xl font-bold mb-4 text-accent">Sign Up</h1>
            <p className="text-muted mb-6">Signup flow coming soon. For now, please log in.</p>
            <Link href="/login" className="btn-secondary">Go to Login</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
