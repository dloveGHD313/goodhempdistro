"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getQuestionsForRole } from "@/lib/onboarding/questions";
import { getDestinationForRole } from "@/lib/onboarding/destination";
import type { OnboardingRole } from "@/lib/onboarding/role";
import QuestionnaireCard from "./QuestionnaireCard";

type Props = {
  role: OnboardingRole;
};

export default function QuestionnaireFlow({ role }: Props) {
  const router = useRouter();
  const questions = getQuestionsForRole(role);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = questions[step];
  const selected = currentQuestion ? answers[currentQuestion.id] ?? null : null;
  const canProceed = selected !== null;
  const isLast = step === questions.length - 1;

  const handleSelect = (value: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleNext = () => {
    if (!canProceed) return;
    if (isLast) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const driver_mode =
      role === "driver" && answers["driver_mode"]
        ? answers["driver_mode"]
        : undefined;

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "1.5",
          role,
          answers,
          driver_mode: driver_mode ?? null,
        }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; role?: string };
      if (data.ok) {
        const dest = getDestinationForRole(role, driver_mode);
        router.replace(dest);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentQuestion) return null;

  return (
    <div className="space-y-6">
      <QuestionnaireCard
        question={currentQuestion}
        selected={selected}
        onSelect={handleSelect}
        stepIndex={step}
        totalSteps={questions.length}
      />
      <div className="max-w-2xl mx-auto flex gap-3 justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0}
          className={`btn-secondary motion-medium ${step === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed || submitting}
          className={`btn-primary motion-medium ${!canProceed || submitting ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {submitting ? "Saving…" : isLast ? "Continue" : "Next"}
        </button>
      </div>
    </div>
  );
}
