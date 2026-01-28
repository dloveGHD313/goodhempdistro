"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

function LoadingState() {
  return (
    <div className="card-glass p-6 text-center">
      <h1 className="text-2xl font-semibold text-accent mb-2">Finalizing your checkout…</h1>
      <p className="text-muted mb-4">Hang tight while we confirm your membership.</p>
      <div className="inline-flex items-center gap-2 text-sm text-muted">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams?.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing session ID. Please return to pricing and try again.");
      return;
    }

    let active = true;
    async function confirmCheckout() {
      try {
        const response = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to confirm checkout");
        }
        if (!active) return;
        setStatus("success");
        setMessage("You're all set! Redirecting you to the feed…");
        setTimeout(() => router.push("/newsfeed"), 1600);
      } catch (error) {
        if (!active) return;
        const errorMessage = error instanceof Error ? error.message : "Checkout confirmation failed.";
        setStatus("error");
        setMessage(errorMessage);
      }
    }

    confirmCheckout();
    return () => {
      active = false;
    };
  }, [router, sessionId]);

  if (!sessionId) {
    return (
      <div className="card-glass p-6 text-center">
        <h1 className="text-2xl font-semibold text-accent mb-2">Checkout session missing</h1>
        <p className="text-muted mb-4">Please return to pricing and try again.</p>
        <Link href="/pricing" className="btn-primary">
          Back to pricing
        </Link>
      </div>
    );
  }

  if (status === "loading") {
    return <LoadingState />;
  }

  return (
    <div className="card-glass p-6 text-center">
      <h1 className="text-2xl font-semibold text-accent mb-2">
        {status === "success" ? "Checkout confirmed" : "Checkout needs attention"}
      </h1>
      <p className="text-muted mb-4">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/newsfeed" className="btn-primary">
          Go to Feed
        </Link>
        <Link href="/pricing" className="btn-secondary">
          View pricing
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1 section-shell">
        <Suspense fallback={<LoadingState />}>
          <CheckoutSuccessContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
