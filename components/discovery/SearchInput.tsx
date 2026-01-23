"use client";

type Props = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function SearchInput({
  label = "Search",
  placeholder = "Search...",
  value,
  onChange,
  className = "",
}: Props) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
      />
    </div>
  );
}
