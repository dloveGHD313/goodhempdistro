"use client";

import { useRouter } from "next/navigation";

type Props = {
  hasVendor: boolean;
};

/**
 * Phase 1 placeholder: questionnaire shell.
 * Later phases add role-specific layered cards, cinematic effects, audio.
 */
export default function OnboardingShellClient({ hasVendor }: Props) {
  const router = useRouter();

  const handleContinue = () => {
    router.push(hasVendor ? "/onboarding/vendor" : "/onboarding/consumer");
  };

  return (
    <div className="max-w-2xl mx-auto surface-card p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-accent mb-2">
          Let&apos;s tailor your experience
        </h1>
        <p className="text-muted">
          Answer a few quick questions — no typing.
        </p>
      </div>
      <button
        type="button"
        onClick={handleContinue}
        className="btn-primary motion-medium"
      >
        Continue
      </button>
    </div>
  );
}
