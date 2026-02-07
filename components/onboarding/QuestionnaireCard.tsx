"use client";

import type { Question, QuestionOption } from "@/lib/onboarding/questions";

type Props = {
  question: Question;
  selected: string | null;
  onSelect: (value: string) => void;
  stepIndex: number;
  totalSteps: number;
};

export default function QuestionnaireCard({
  question,
  selected,
  onSelect,
  stepIndex,
  totalSteps,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto surface-card p-8 space-y-6 animate-fade-in opacity-0 motion-medium">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>Question {stepIndex + 1} of {totalSteps}</span>
      </div>
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-accent mb-4">
          {question.prompt}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((opt: QuestionOption) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className={`rounded-xl border-2 px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand-lime)] motion-medium ${
                selected === opt.value
                  ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/15"
                  : "border-[var(--border)] bg-[var(--surface)]/60 hover:border-[var(--brand-lime)] hover:bg-[var(--surface)]"
              }`}
            >
              <span className="font-medium text-white">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
