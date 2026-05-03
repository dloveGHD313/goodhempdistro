"use client";

import { useState } from "react";

type StateRule = {
  state_code: string;
  state_name: string;
  allows_sale_hemp: boolean;
  allows_sale_intoxicating: boolean | null;
  notes: string | null;
};

type PatchPayload = {
  allows_sale_hemp?: boolean;
  allows_sale_intoxicating?: boolean | null;
  notes?: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function TriStateSelect({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const strVal = value === true ? "true" : value === false ? "false" : "null";
  return (
    <select
      value={strVal}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "true" ? true : v === "false" ? false : null);
      }}
      className="bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-sm text-white"
    >
      <option value="true">Yes</option>
      <option value="false">No</option>
      <option value="null">Unknown</option>
    </select>
  );
}

export default function StateRulesClient({ initialRules }: { initialRules: StateRule[] }) {
  const [rules, setRules] = useState<StateRule[]>(initialRules);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<StateRule>>>({});

  const getRule = (code: string): StateRule =>
    ({ ...rules.find((r) => r.state_code === code)!, ...(pendingEdits[code] ?? {}) });

  const setPending = (code: string, patch: Partial<StateRule>) => {
    setPendingEdits((prev) => ({ ...prev, [code]: { ...(prev[code] ?? {}), ...patch } }));
  };

  const handleSave = async (code: string) => {
    const pending = pendingEdits[code];
    if (!pending || Object.keys(pending).length === 0) return;

    setSaveStates((prev) => ({ ...prev, [code]: "saving" }));

    const payload: PatchPayload = {};
    if (pending.allows_sale_hemp !== undefined) payload.allows_sale_hemp = pending.allows_sale_hemp;
    if ("allows_sale_intoxicating" in pending) payload.allows_sale_intoxicating = pending.allows_sale_intoxicating ?? null;
    if (pending.notes !== undefined) payload.notes = pending.notes;

    try {
      const res = await fetch(`/api/admin/state-rules/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());

      setRules((prev) =>
        prev.map((r) => (r.state_code === code ? { ...r, ...pending } : r))
      );
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });
      setSaveStates((prev) => ({ ...prev, [code]: "saved" }));
      setTimeout(() => setSaveStates((prev) => ({ ...prev, [code]: "idle" })), 2000);
    } catch {
      setSaveStates((prev) => ({ ...prev, [code]: "error" }));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-muted text-xs uppercase tracking-wider">
            <th className="py-3 pr-4 w-16">Code</th>
            <th className="py-3 pr-4">State</th>
            <th className="py-3 pr-4 w-32">Hemp Sales</th>
            <th className="py-3 pr-4 w-40">Intoxicating</th>
            <th className="py-3 pr-4">Notes</th>
            <th className="py-3 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((baseRule) => {
            const rule = getRule(baseRule.state_code);
            const hasPending = !!pendingEdits[baseRule.state_code];
            const saveState = saveStates[baseRule.state_code] ?? "idle";
            return (
              <tr
                key={rule.state_code}
                className="border-b border-[var(--border)]/40 hover:bg-white/[0.02]"
              >
                <td className="py-2 pr-4 font-mono font-semibold text-accent">
                  {rule.state_code}
                </td>
                <td className="py-2 pr-4">{rule.state_name}</td>
                <td className="py-2 pr-4">
                  <TriStateSelect
                    value={rule.allows_sale_hemp}
                    onChange={(v) => setPending(rule.state_code, { allows_sale_hemp: v ?? true })}
                  />
                </td>
                <td className="py-2 pr-4">
                  <TriStateSelect
                    value={rule.allows_sale_intoxicating}
                    onChange={(v) => setPending(rule.state_code, { allows_sale_intoxicating: v })}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={rule.notes ?? ""}
                    onChange={(e) =>
                      setPending(rule.state_code, { notes: e.target.value || undefined })
                    }
                    placeholder="Add notes…"
                    className="w-full bg-transparent border border-transparent focus:border-[var(--border)] rounded px-2 py-1 text-sm placeholder:text-muted/40 focus:outline-none"
                  />
                </td>
                <td className="py-2 text-right">
                  {saveState === "saving" ? (
                    <span className="text-xs text-muted">Saving…</span>
                  ) : saveState === "saved" ? (
                    <span className="text-xs text-green-400">✓ Saved</span>
                  ) : saveState === "error" ? (
                    <span className="text-xs text-red-400">Error</span>
                  ) : hasPending ? (
                    <button
                      type="button"
                      onClick={() => handleSave(rule.state_code)}
                      className="btn-secondary text-xs px-3 py-1"
                    >
                      Save
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
