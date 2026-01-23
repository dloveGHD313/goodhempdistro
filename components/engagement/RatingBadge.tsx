"use client";

type Props = {
  average: number | null;
  count: number;
  className?: string;
};

export default function RatingBadge({ average, count, className = "" }: Props) {
  if (!count) {
    return (
      <span className={`text-xs text-muted ${className}`}>New</span>
    );
  }

  return (
    <span className={`text-xs text-[var(--brand-lime)] ${className}`}>
      ★ {average?.toFixed(1)} ({count})
    </span>
  );
}
