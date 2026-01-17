import Footer from "@/components/Footer";
import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Sign Up | Good Hemp Distro",
  description: "Create your Good Hemp Distro account",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto surface-card p-8 space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-4 text-accent">Sign Up</h1>
              <p className="text-muted">
                Create an account to access the full marketplace and community features.
              </p>
            </div>
            <SignupForm />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
