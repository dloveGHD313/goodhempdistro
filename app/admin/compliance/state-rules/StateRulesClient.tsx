"use client";

import { useState } from "react";
import { STATE_NAMES } from "@/lib/compliance/stateNames";
import type { StateRule } from "./page";

type PatchPayload = {
  allows_sale_non_intoxicating?: boolean | null;
  allows_delivery_non_intoxicating?: boolean | null;
  allows_sale_intoxicating?: boolean | null;
  allows_delivery_intoxicating?: boolean | null;
  notes?: string | null;
  sources?: unknown | null;
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

const BOOL_COLS = [
  "allows_sale_non_intoxicating",
  "allows_delivery_non_intoxicating",
  "allows_sale_intoxicating",
  "allows_delivery_intoxicating",
] as const;

type BoolCol = (typeof BOOL_COLS)[number];

export default function StateRulesClient({ initialRules }: { initialRules: StateRule[] }) {
  const [rules, setRules] = useState<StateRule[]>(initialRules);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<StateRule>>>({});
  const [sourcesErrors, setSourcesErrors] = useState<Record<string, string>>({});

  const getRule = (code: string): StateRule =>
    ({ ...rules.find((r) => r.state_code === code)!, ...(pendingEdits[code] ?? {}) });

  const setPending = (code: string, patch: Partial<StateRule>) => {
    setPendingEdits((prev) => ({ ...prev, [code]: { ...(prev[code] ?? {}), ...patch } }));
  };

  const handleSourcesChange = (code: string, raw: string) => {
    setPending(code, { sources: raw });
    if (raw.trim() === "" || raw.trim() === "null") {
      setSourcesErrors((prev) => { const n = { ...prev }; delete n[code]; return n; });
      return;
    }
    try {
      JSON.parse(raw);
      setSourcesErrors((prev) => { const n = { ...prev }; delete n[code]; return n; });
    } catch {
      setSourcesErrors((prev) => ({ ...prev, [code]: "Invalid JSON" }));
    }
  };

  const handleSave = async (code: string) => {
    if (sourcesErrors[code]) return;
    const pending = pendingEdits[code];
    if (!pending || Object.keys(pending).length === 0) return;

    setSaveStates((prev) => ({ ...prev, [code]: "saving" }));

    const payload: PatchPayload = {};
    for (const col of BOOL_COLS) {
      if (col in pending) payload[col] = (pending as Record<BoolCol, boolean | null>)[col] ?? null;
    }
    if ("notes" in pending) payload.notes = (pending.notes as string | null) ?? null;
    if ("sources" in pending) {
      const raw = pending.sources as string | null;
      if (!raw || raw.trim() === "" || raw.trim() === "null") {
        payload.sources = null;
      } else {
        try {
          payload.sources = JSON.parse(raw);
        } catch {
          setSaveStates((prev) => ({ ...prev, [code]: "error" }));
          return;
        }
      }
    }

    try {
      const res = await fetch(`/api/admin/state-rules/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());

      const { rule } = await res.json();
      setRules((prev) => prev.map((r) => (r.state_code === code ? rule : r)));
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
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-muted text-xs uppercase tracking-wider">
            <th className="py-3 pr-3 w-12">Code</th>
            <th className="py-3 pr-3 w-36">State</th>
            <th className="py-3 pr-3 w-32">Sale (non-int)</th>
            <th className="py-3 pr-3 w-36">Delivery (non-int)</th>
            <th className="py-3 pr-3 w-28">Sale (int)</th>
            <th className="py-3 pr-3 w-32">Delivery (int)</th>
            <th className="py-3 pr-3">Notes</th>
            <th className="py-3 pr-3 w-48">Sources (JSON)</th>
            <th className="py-3 pr-3 w-24">Updated</th>
            <th className="py-3 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((baseRule) => {
            const rule = getRule(baseRule.state_code);
            const hasPending = !!pendingEdits[baseRule.state_code];
            const saveState = saveStates[baseRule.state_code] ?? "idle";
            const srcError = sourcesErrors[baseRule.state_code];
            const sourcesRaw =
              rule.sources != null
                ? typeof rule.sources === "string"
                  ? rule.sources
                  : JSON.stringify(rule.sources, null, 2)
                : "";
            const updatedDate = rule.updated_at
              ? new Date(rule.updated_at).toLocaleDateString()
              : "—";

            return (
              <tr
                key={rule.state_code}
                className="border-b border-[var(--border)]/40 hover:bg-white/[0.02] align-top"
              >
                <td className="py-2 pr-3 font-mono font-semibold text-accent pt-3">
                  {rule.state_code}
                </td>
                <td className="py-2 pr-3 pt-3">
                  {STATE_NAMES[rule.state_code] ?? rule.state_code}
                </td>
                {BOOL_COLS.map((col) => (
                  <td key={col} className="py-2 pr-3">
                    <TriStateSelect
                      value={(rule as Record<BoolCol, boolean | null>)[col]}
                      onChange={(v) => setPending(rule.state_code, { [col]: v })}
                    />
                  </td>
                ))}
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={rule.notes ?? ""}
                    onChange={(e) =>
                      setPending(rule.state_code, { notes: e.target.value || null })
                    }
                    placeholder="Add notes…"
                    className="w-full bg-transparent border border-transparent focus:border-[var(--border)] rounded px-2 py-1 text-sm placeholder:text-muted/40 focus:outline-none"
                  />
                </td>
                <td className="py-2 pr-3">
                  <textarea
                    rows={2}
                    value={sourcesRaw}
                    onChange={(e) => handleSourcesChange(rule.state_code, e.target.value)}
                    placeholder='["https://…"]'
                    className={`w-full bg-transparent border rounded px-2 py-1 text-xs font-mono placeholder:text-muted/40 focus:outline-none resize-none ${
                      srcError
                        ? "border-red-500/60 focus:border-red-400"
                        : "border-transparent focus:border-[var(--border)]"
                    }`}
                  />
                  {srcError && <p className="text-red-400 text-xs mt-0.5">{srcError}</p>}
                </td>
                <td className="py-2 pr-3 text-muted text-xs pt-3">{updatedDate}</td>
                <td className="py-2 text-right pt-3">
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
                      disabled={!!srcError}
                      className="btn-secondary text-xs px-3 py-1 disabled:opacity-40"
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
