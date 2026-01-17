import Footer from "@/components/Footer";
import type { Metadata } from "next";
import LoginForm from "./LoginForm";

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
            <LoginForm />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
