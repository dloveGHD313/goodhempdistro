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

function FinishingSetupState() {
  return (
    <div className="card-glass p-6 text-center">
      <h1 className="text-2xl font-semibold text-accent mb-2">Finishing setup…</h1>
      <p className="text-muted mb-4">Your vendor account is activating. Redirecting to dashboard shortly.</p>
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
  const [status, setStatus] = useState<"loading" | "finishing_setup" | "success" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isVendorCheckout, setIsVendorCheckout] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing session ID. Please return to pricing and try again.");
      return;
    }

    let active = true;
    const maxRoleRetries = 3;
    const roleRetryDelayMs = 2000;

    async function confirmCheckout(retryCount = 0) {
      try {
        const response = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (payload?.error === "Subscription not found" && retryCount < 1) {
            await new Promise((r) => setTimeout(r, 1500));
            return confirmCheckout(retryCount + 1);
          }
          throw new Error(payload?.error || "Failed to confirm checkout");
        }
        if (!active) return;
        const data = await response.json();
        const isVendor = data?.planType === "vendor";
        setIsVendorCheckout(isVendor);
        setMessage(isVendor ? "Vendor account activated." : "You're all set!");
        setStatus("success");

        if (isVendor) {
          (async function waitForRoleThenRedirect() {
            for (let i = 0; i < maxRoleRetries && active; i++) {
              await new Promise((r) => setTimeout(r, i === 0 ? 800 : roleRetryDelayMs));
              if (!active) return;
              try {
                const profileRes = await fetch("/api/profile");
                if (profileRes.ok) {
                  const profileData = await profileRes.json();
                  if (profileData?.role === "vendor") {
                    router.push("/vendors/dashboard");
                    return;
                  }
                }
              } catch {
                // ignore
              }
              if (i < maxRoleRetries - 1 && active) {
                setStatus("finishing_setup");
              }
            }
            if (active) {
              setStatus("finishing_setup");
              setTimeout(() => router.push("/vendors/dashboard"), 1500);
            }
          })();
        } else {
          setTimeout(() => router.push("/newsfeed"), 1600);
        }
      } catch (error) {
        if (!active) return;
        const errorMessage = error instanceof Error ? error.message : "Checkout confirmation failed.";
        setStatus("error");
        setMessage(
          errorMessage === "Subscription not found"
            ? "Subscription is still processing. Please wait a moment and refresh, or go to your dashboard to check status."
            : errorMessage
        );
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

  if (status === "finishing_setup") {
    return <FinishingSetupState />;
  }

  return (
    <div className="card-glass p-6 text-center">
      <h1 className="text-2xl font-semibold text-accent mb-2">
        {status === "success" && isVendorCheckout ? "Vendor account activated" : status === "success" ? "Checkout confirmed" : status === "error" ? "Checkout needs attention" : "Checkout confirmed"}
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
