"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getWorkoutFlowState,
  setWorkoutFlowState,
  WORKOUT_REDIRECTS,
  type WorkoutPath,
} from "@/lib/phase2-workout-flow";
import { HeroShell } from "@/components/ui/HeroShell";

const PATHS: { id: WorkoutPath; label: string; promise: string; icon: string }[] = [
  { id: "shopper", label: "Shopper / Community", promise: "Discover products and join the community.", icon: "🛍️" },
  { id: "vendor", label: "Vendor", promise: "Sell products and grow your brand.", icon: "🏪" },
  { id: "logistics", label: "Logistics / Driver", promise: "Apply to deliver and offer services.", icon: "🚚" },
  { id: "builder", label: "Builder / Contractor", promise: "Hemp construction and professional services.", icon: "🏗️" },
  { id: "affiliate", label: "Affiliate", promise: "Earn rewards by referring others to the community.", icon: "💰" },
];

export default function StartFlowClient() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [path, setPath] = useState<WorkoutPath | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getWorkoutFlowState();
    if (stored?.selectedPath) {
      setPath(stored.selectedPath);
      setStep(2);
    }
    setMounted(true);
  }, []);

  const handleSelectPath = (p: WorkoutPath) => {
    setPath(p);
    setWorkoutFlowState({ selectedPath: p, lastStepCompleted: 1 });
    setStep(2);
  };

  const handleContinueWithoutAccount = () => {
    if (!path) return;
    setWorkoutFlowState({ lastStepCompleted: 2 });
    router.push(WORKOUT_REDIRECTS[path]);
  };

  const handleSignUpFirst = () => {
    if (!path) return;
    setWorkoutFlowState({ lastStepCompleted: 2 });
    const redirect = WORKOUT_REDIRECTS[path];
    router.push(`/signup?next=${encodeURIComponent(redirect)}&role=${encodeURIComponent(path)}`);
  };

  if (!mounted) {
    return (
      <main className="welcome-hero min-h-[50vh] flex flex-col items-center justify-center" aria-label="Start your journey">
        <span className="sr-only" aria-live="polite">Loading…</span>
        <div className="h-32 w-full max-w-2xl rounded-xl bg-[var(--surface)]/40 animate-pulse" aria-hidden="true" />
      </main>
    );
  }

  if (step === 1) {
    return (
      <main className="welcome-hero py-10 px-4" aria-label="Choose your path">
        <HeroShell cinematic glassPanel contentClassName="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.35em] text-muted mb-2">Get Started</p>
          <h1 className="hero-title text-accent mb-2">Where do you fit?</h1>
          <p className="hero-subtitle mb-8">
            Pick one path and we&apos;ll take you to the right place in seconds.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            {PATHS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPath(p.id)}
                className="quiz-card rounded-xl border-2 border-[var(--border)] hover:border-[var(--brand-lime)] hover:bg-[var(--surface)]/80 px-5 py-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]"
                aria-label={`${p.label}: ${p.promise}`}
              >
                <span className="text-2xl block mb-2" aria-hidden="true">{p.icon}</span>
                <span className="font-semibold text-foreground block">{p.label}</span>
                <span className="text-sm text-muted">{p.promise}</span>
              </button>
            ))}
          </div>
          <p className="text-muted text-sm mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </HeroShell>
      </main>
    );
  }

  const pathMeta = PATHS.find((p) => p.id === path);
  const destination = path ? WORKOUT_REDIRECTS[path] : "#";

  return (
    <main className="welcome-hero py-10 px-4" aria-label="Next step">
      <HeroShell cinematic glassPanel contentClassName="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.35em] text-muted mb-2">Almost there</p>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {pathMeta?.label ?? path}
        </h2>
        <p className="text-muted text-sm mb-6">
          Create a free account to save progress and get a personalized experience, or go straight there.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleSignUpFirst}
            className="btn-primary motion-medium"
          >
            Sign me up, then take me there
          </button>
          <button
            type="button"
            onClick={handleContinueWithoutAccount}
            className="btn-secondary motion-medium"
          >
            Continue without account
          </button>
        </div>
        <p className="text-muted text-xs mt-4">
          You&apos;ll go to: <strong className="text-foreground">{destination}</strong>
        </p>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-muted text-sm mt-4 hover:text-foreground underline"
        >
          Choose a different path
        </button>
      </HeroShell>
    </main>
  );
}
