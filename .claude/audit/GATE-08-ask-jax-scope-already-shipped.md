# GATE-08 — Build #4 (Ask JAX) scope already shipped via mascot

**Discovered:** 2026-05-12 during Phase 3 pre-flight for Build #4
**Severity:** P1 — material scope mismatch with directive
**Status:** Halting Phase 5 (Build #4) until CEO confirms direction

## What I found

The Phase 5 directive treats Ask JAX as greenfield. Pre-flight inspection reveals that **`/api/mascot-chat/route.ts` is a production-ready JAX chat system** already running on every page (mounted globally via `MascotGate` + `MascotWidget` in `app/layout.tsx`).

Existing infrastructure (already shipped pre-Phase 2):

- ✅ OpenAI integration — uses configured `OPENAI_API_KEY`
- ✅ Eligibility tiers — `lib/jax/eligibility.ts` (free, vendor_starter/mid/top, consumer plans)
- ✅ Usage tracking — `lib/jax/usage.ts`: per-user monthly count, global daily count, increment helpers
- ✅ Paid-plan gating — eligibility helpers check `profiles.plan = 'paid'`
- ✅ Intent classification — `server/mascot/intents.ts`
- ✅ Safety / scope refusal — `server/mascot/safety.ts`
- ✅ Tool-call handlers — searchFeedPosts, searchProducts, searchEvents, getVendorHelp, getDriverDeliveries, getLogisticsLoads, getOrderDetails
- ✅ Live API route — `app/api/mascot-chat/route.ts` is `force-dynamic`, runs in production
- ✅ UI — `components/mascot/MascotWidget.tsx` (mounted globally)
- ✅ Preview surface — `app/jax-preview/page.tsx`
- ✅ Coming-soon stub — `app/ask-jax/page.tsx` (shipped in PR #175 because I didn't know about the mascot)

## What's NOT yet wired

| Directive spec item | Current state |
|---|---|
| `/ask-jax` route | Stub only (coming-soon page from PR #175) |
| Model = `gpt-4o-mini` | Need to verify what model the mascot uses |
| Monthly cost cap = **$50 USD HARD CUTOFF** | Currently rate-limited by **count** (daily / monthly message count), NOT by dollar cost. Need to add cost tracking + cap |
| `ask_jax_usage` / `ask_jax_conversations` / `ask_jax_messages` tables | Mascot uses different tables: `jax_global_daily`, `jax_usage`, and ephemeral conversation state |
| Compliance RAG (against Build #5 state matrix) | Not present — mascot tools don't include compliance lookups yet |
| Dedicated `/ask-jax` chat UI page | Stub only |
| Streaming SSE | Mascot returns JSON; not streaming |

## Three forward paths

### Option A — Thin wrapper (recommended, ~1 PR)

- Wire `/ask-jax` to surface the existing mascot widget as a full-page chat UI (drop the coming-soon stub)
- Add a $50/month cost cap on top of existing count-based limits — extend `jax_usage` schema with `cost_cents`, add daily cron computing month-to-date OpenAI spend, hard-cutoff when over
- Add compliance RAG tool to mascot tool set later when Build #5 ships
- Reuse all existing tooling

**Pros:** ~80% reuse, ships in 1 PR, no parallel codepaths.
**Cons:** UI is the existing mascot widget styling, not a dedicated chat page design. Mascot may not feel like "Ask JAX" brand-wise. No streaming SSE (mascot returns JSON).

### Option B — Dedicated chat page on existing API (~2 PRs)

- Build a new `/ask-jax/page.tsx` + `ChatClient.tsx` with conversation history, message threading, dedicated chat aesthetic
- Use existing `/api/mascot-chat` POST as the backend (rename to `/api/ask-jax` if we want, or keep route)
- Same cost-cap addition as Option A
- Compliance RAG when Build #5 ships

**Pros:** Brand-consistent dedicated surface; can ship a marketing-ready landing for paid users.
**Cons:** Two UIs against same backend (mascot widget + ask-jax page); mascot widget may need to be hidden on `/ask-jax` to avoid duplication.

### Option C — Greenfield (~3 PRs, per original directive verbatim)

- Build new schema (`ask_jax_usage`, `ask_jax_conversations`, `ask_jax_messages`)
- New `/api/ask-jax` route with SSE streaming
- Dedicated `/ask-jax` chat UI
- Migrate or deprecate the mascot system later

**Pros:** Clean separation; mascot continues to live in widget, JAX gets first-class home.
**Cons:** Significant duplication of working code; mascot has 7 tool handlers + intent classification + safety I'd be reimplementing.

## CEO decision requested

Pick one of A / B / C. My recommendation is **Option A** — the existing mascot system is well-designed and Ask JAX as a destination page can be a thin reskin of the same widget. Cost cap is straightforward to add. Compliance RAG slots in cleanly when Build #5 lands.

If Option C is preferred (greenfield), I'll note in the GATE doc that mascot system stays parallel until JAX reaches feature parity, then we deprecate one.

**Halting Phase 5 (Build #4) until CEO chooses.** Phase 4 (Build #3 Stripe Connect) does NOT depend on this — Phase 4 can proceed in parallel. Build #5 (regional compliance) is also independent. Build #10 (Jax episodes) is a separate content surface, not affected.
