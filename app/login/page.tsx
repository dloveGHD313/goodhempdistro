import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In | Good Hemp Distro",
  description:
    "Sign in to your Good Hemp Distro account to manage your products, track orders, and grow your hemp business.",
  openGraph: {
    title: "Sign In | Good Hemp Distro",
    description:
      "Sign in to your Good Hemp Distro account to manage your products, track orders, and grow your hemp business.",
    url: `${brand.url}/login`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign In | Good Hemp Distro",
    description:
      "Sign in to your Good Hemp Distro account to manage your products, track orders, and grow your hemp business.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; confirm?: string }>;
}) {
  const params = await searchParams;
  const successMessage = params.message === "password_reset_success"
    ? "Password reset successful! You can now log in with your new password."
    : params.confirm === "1"
      ? "Check your email to confirm your account."
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
              <p className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">Welcome back</p>
              <h1 className="text-4xl font-bold mb-3">Sign in</h1>
              <p className="text-muted">
                JAX picks up where you left off — your feed, tools and dashboard are tailored to the lane you chose.
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
            <div className="flex flex-col gap-2 border-t border-white/10 pt-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
              <span>
                New here?{" "}
                <Link href="/welcome" className="font-semibold text-accent underline-offset-4 hover:underline">
                  Meet JAX and pick your lane
                </Link>
              </span>
              <Link href="/welcome?noboot=1" className="underline-offset-4 hover:underline">
                ← Back to Good Hemp Distro
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
