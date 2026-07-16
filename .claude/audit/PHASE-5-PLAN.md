# Phase 5 — Build #4 Ask JAX Thin Wrapper (Implementation Plan)

**Status:** Plan only. No code commits. Waiting on CEO smoke-test completion of Phase 4 before execution starts.
**Scope:** Per GATE-08 CEO decision — thin wrapper on existing `/api/mascot-chat`, 1 PR total.
**Standing rule:** reuse existing systems; don't build parallels.

---

## What already exists (DO NOT DUPLICATE)

| Surface | Path | Notes |
|---|---|---|
| OpenAI chat API | `app/api/mascot-chat/route.ts` (558 LOC) | gpt-4o-mini, tool use, intent classification, safety checks, system prompt with medical/legal disclaimers. Atomic usage increments AFTER OpenAI succeeds (failed calls don't burn quota). |
| Usage tracking | `lib/jax/usage.ts` | Per-user monthly message count + per-day global message count (default cap 5000/day). Postgres RPCs `jax_increment_user_monthly` + `jax_increment_global_daily`. |
| Eligibility (paid gate) | `lib/jax/eligibility.ts` | Tier-based: `admin/vendor_top` unlimited; `vendor_mid` 1000/mo; `vendor_starter` 200/mo; `consumer` 100/mo; `free` blocked. Hooks into existing `getConsumerAccessStatus` + `getVendorAccessStatus`. |
| DB tables | `jax_usage`, `jax_global_daily` | Migration `20260501020000_jax_usage.sql`. RLS in place. |
| Chat UI components | `components/mascot/*` | MascotPanel, MascotWidget, MascotAvatar, JaxFloatingScaffold, JaxWelcomeHero, config.ts. Already render `/api/mascot-chat` responses end-to-end. |
| /ask-jax page | `app/ask-jax/page.tsx` | **Currently a coming-soon stub from PR #175**. This is what gets replaced with the real chat UI. |

## What's missing — three things, one PR

### Δ1. $50/month HARD CUTOFF — global monthly dollar ceiling

The existing system caps **messages/day globally** at 5000 and **messages/month per user** by tier. It does **not** track dollar cost or enforce a monthly global ceiling. The directive's "$50/month HARD CUTOFF" requires a new fail-closed circuit breaker.

**Design:**
- Compute per-call cost from `usage` field on OpenAI's response (already returned). Pricing constants for gpt-4o-mini: `$0.15 / 1M input tokens` + `$0.60 / 1M output tokens`. Hardcode rates as `JAX_GPT4O_MINI_INPUT_PER_TOKEN` / `_OUTPUT_PER_TOKEN`.
- Add columns to `jax_global_daily`: `input_tokens BIGINT NOT NULL DEFAULT 0`, `output_tokens BIGINT NOT NULL DEFAULT 0`, `cost_cents BIGINT NOT NULL DEFAULT 0` (additive migration; no risk to existing data).
- Add new Postgres RPC: `jax_increment_global_daily_with_cost(input_tokens, output_tokens, cost_cents)` — atomic per-day-row increment of all three counters in one statement.
- New helper `getCurrentMonthCostCents()` — sums `cost_cents` across all `jax_global_daily` rows with `day_utc` in the current UTC month.
- New constant: `JAX_MONTHLY_GLOBAL_COST_CAP_CENTS` = 5000 (default $50, overridable via `JAX_MONTHLY_GLOBAL_COST_CAP_CENTS` env var).
- Wire into `mascot-chat/route.ts` BEFORE the OpenAI call: if `await getCurrentMonthCostCents() >= cap`, return a "temporarily unavailable" message (fail-closed). Reuse the existing `unavailableResponse` helper pattern.
- After OpenAI succeeds, increment with computed cost. The post-increment cost may briefly exceed the cap by one message (acceptable — circuit breaker is "no new requests once threshold hit", not "atomically reject the request that crosses the threshold"). This matches the existing per-message-count circuit-breaker semantics.

**Files touched:**
- New: `supabase/migrations/20260520_jax_cost_tracking.sql` (adds 3 columns + 1 RPC; ALTER TABLE additive only)
- Modified: `lib/jax/usage.ts` — new `getCurrentMonthCostCents()` + new increment RPC wrapper + new cost-cap constant
- Modified: `app/api/mascot-chat/route.ts` — replace `incrementGlobalDaily()` with `incrementGlobalDailyWithCost(usage)` + add cost-cap check at top alongside the existing message-cap check

**Cost-cap fail-closed copy:** "Ask JAX is temporarily unavailable while we top up capacity. Try again at the start of next month, or reach out to support."

### Δ2. System prompt sharpening — explicit off-topic refusal

The existing prompt at `app/api/mascot-chat/route.ts:74-120` covers:
- ✅ Medical: "Never give medical advice, only general wellness information with 'consult a healthcare provider' disclaimer"
- ✅ Legal/compliance: Farm Bill, state laws, age requirements mentioned
- ❌ **Off-topic refusal: NOT explicit.** The prompt invites JAX to "answer from general training" for knowledge questions, with no clear refusal pattern for non-hemp/platform queries.

**Edit:** Add a new SAFETY-section bullet:

```
SAFETY:
- Never give medical advice — direct users to a healthcare provider.
- Never give legal advice — direct users to a hemp-compliance attorney or
  link to /services/hemp-attorneys.
- Refuse off-topic questions politely. JAX answers hemp/cannabinoid topics,
  GHD platform questions, and product recommendations only. For everything
  else: "I'm focused on hemp and the Good Hemp Distros platform — let me
  know how I can help with those." Do not attempt to answer general
  trivia, current events, code, math, etc.
- Always note state legality varies for THC products.
- Respect user privacy, don't reference profile data unless relevant.
```

Sharpen the existing "TONE" bullet to match: "Never claim to complete purchases, account changes, or perform actions outside the platform's scope."

**Files touched:**
- Modified: `app/api/mascot-chat/route.ts` `buildSystemPrompt` only (lines 74-120 area)

**Test:** add a system-prompt-coverage assertion to a new test that the function output contains the canonical refusal phrases. Not an integration test against OpenAI — just a string-contains check that the prompt was assembled correctly.

### Δ3. `/ask-jax` page — replace coming-soon stub with chat UI

Currently at `app/ask-jax/page.tsx` (from PR #175): coming-soon page with email-capture form using `ComingSoonPage` component.

**Replace with:** a dedicated chat page that mounts an existing mascot component. The simplest path:

```tsx
// app/ask-jax/page.tsx  (new shape)
import { Metadata } from "next";
import AskJaxChat from "./AskJaxChat"; // new client component, thin wrapper

export const metadata: Metadata = {
  title: "Ask JAX | Good Hemp Distros",
  description: "JAX is GHD's hemp-compliance copilot. Available on paid plans.",
};

export default function AskJaxPage() {
  return (
    <main className="min-h-screen bg-[#0D1512] text-[#F0EDE6]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-serif mb-4">Ask JAX</h1>
        <p className="text-zinc-300 mb-8">
          Hemp compliance, product recommendations, and platform help.
        </p>
        <AskJaxChat />
      </div>
    </main>
  );
}
```

`AskJaxChat` is a thin client component that:
1. Calls `getJaxEligibility` (via `/api/jax/eligibility` or similar — need to verify if a public eligibility endpoint exists; if not, add a tiny `GET /api/jax/eligibility` returning `{ eligible, tier, monthlyLimit }`).
2. If `eligible: false`, render an upgrade prompt linking to `/pricing` instead of the chat.
3. If `eligible: true`, render the existing `MascotPanel` (or extract its chat core) bound to a dedicated `/ask-jax` context so the floating widget and the page chat don't conflict.

**Reuse decision tree:**
- Best case: `MascotPanel` already accepts a `context` prop and renders standalone. Extract or render it directly.
- Worst case: extract the chat-message + send-input parts into a new `<ChatThread />` component and use it in both `MascotPanel` and the new `AskJaxChat`.

(Verification of which case applies happens at code-time — flagged as a small fork the planner can't pre-resolve without running the code.)

**Files touched:**
- Replaced: `app/ask-jax/page.tsx`
- New: `app/ask-jax/AskJaxChat.tsx`
- Maybe new: `app/api/jax/eligibility/route.ts` (tiny GET endpoint) — only if no existing eligibility API exists; needs a 5-min scan at code-time.
- Maybe modified: `components/mascot/MascotPanel.tsx` IF extraction is needed (avoid if possible — keeps PR scope small).

## Files NOT touched

- `/api/mascot-chat/route.ts` — only the system prompt + the cost-cap wiring change. The OpenAI call, tool use, intent classification, eligibility check, safety check stay as-is.
- `lib/jax/eligibility.ts` — no changes. Tiers + limits unchanged.
- Existing mascot widget (`MascotGate`, `MascotMount`, etc.) — still operates as the floating chat.
- DB schema beyond the 3 additive columns + 1 new RPC.

## Test plan

Single test file `__tests__/jax-cost-cap.test.ts`:
1. `JAX_GPT4O_MINI_*_PER_TOKEN` constants match the pricing in code (sanity check against drift)
2. `getCurrentMonthCostCents()` returns 0 when no rows
3. Mock RPC and verify atomic increment shape
4. Mock cost-cap exceeded → `unavailableResponse` returned
5. Mock cost-cap not exceeded → OpenAI call proceeds (existing path)
6. System prompt contains the canonical off-topic refusal phrases
7. System prompt contains the medical-disclaimer phrase
8. System prompt contains the legal-advice refusal phrase

Existing tests stay unchanged (mascot-chat integration tests already cover the happy paths).

## Phase 5 PR title (planned)

`feat(ask-jax): thin wrapper page + $50 monthly cost cap + sharpened system prompt (Build #4)`

## Halt conditions (sub-gates per directive)

- **OPENAI_API_KEY env var:** verify it exists in Vercel Production env. If absent → GATE-13.
- **Pricing constants:** if gpt-4o-mini pricing changes mid-PR → use the rates that were current at directive issue ($0.15/$0.60 per 1M). If CEO wants the model swapped, surface separately.
- **MascotPanel extraction:** if the existing component is too entangled with the floating widget to render standalone, halt before doing a 200+ LOC refactor — surface as scope expansion request.

## Estimated size

- 1 migration (~30 LOC additive)
- 1 RPC (~15 LOC Postgres)
- ~80 LOC modifications across `lib/jax/usage.ts` + `app/api/mascot-chat/route.ts`
- New `app/ask-jax/AskJaxChat.tsx` (~80 LOC) + replaced `page.tsx` (~30 LOC)
- ~150 LOC test file
- Total: ~400 LOC, single PR
