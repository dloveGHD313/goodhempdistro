import Footer from "@/components/Footer";
import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Login | Good Hemp Distro",
  description: "Access your Good Hemp Distro account",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const successMessage = params.message === "password_reset_success"
    ? "Password reset successful! You can now log in with your new password."
    : null;
  const errorMessage = params.error === "invalid_reset_link"
    ? "Invalid or expired reset link. Please request a new password reset."
    : params.error === "missing_code"
    ? "Missing reset code. Please use the link from your email."
    : params.error === "no_session"
    ? "No active session found. Please use the link from your password reset email."
    : null;

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
            {successMessage && (
              <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 text-green-400">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
                {errorMessage}
              </div>
            )}
            <LoginForm />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
