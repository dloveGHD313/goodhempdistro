# Phase 6 — Build #5 Regional Compliance — Dataset & Brownfield Discovery

**Status:** Discovery only. No code commits. Surfaced now to de-risk Phase 6 before it starts.

---

## BROWNFIELD FINDING — state-rules system already partially shipped

`grep` + Supabase reveal substantial existing infrastructure. **Phase 6 is a thin extension, not a build-from-scratch.**

### Already in production

| Surface | Path | What it does |
|---|---|---|
| `hemp_state_rules` table | `supabase/migrations/077_phase7_hemp_state_rules.sql` | Per-state row: `(state_code PK, allows_sale_non_intoxicating, allows_delivery_non_intoxicating, allows_sale_intoxicating, allows_delivery_intoxicating, notes, sources jsonb, last_verified_at, updated_by)`. RLS: public read; admin write. |
| Seed status | (verified via Supabase MCP) | **51 rows seeded** (50 states + DC). 51 rows allow delivery non-intoxicating; 0 allow delivery intoxicating. **0 rows have `last_verified_at` populated → all data is placeholder, not legally verified.** |
| Server helpers | `lib/server/hempStateRules.ts`, `lib/server/deliveryStateRules.ts` | `getHempStateRule()`, `isDeliveryAllowedForCategory()`, `isSaleAllowedForCategory()`. |
| Already used at checkout | `app/api/checkout/create-session/route.ts` (PR-B touched this earlier) | Imports + uses the helpers to validate ship-to-state at session creation. |
| Admin UI | `app/admin/compliance/page.tsx` + `ComplianceClient.tsx` + `state-rules/` sub-page | View + edit per-state rules; tied into `NAV_ADMIN` from PR #188. |
| Admin API | `app/api/admin/state-rules/[code]/route.ts` | RESTful per-state update endpoint. |

### Directive vs. reality

CEO directive PR-K specified a NEW table:
```sql
state_compliance_matrix (category_slug, state_code, allowed, source, source_url, last_verified_at, notes)
```

Existing schema is **broader/categorical** — `non_intoxicating` vs `intoxicating` (2 buckets) — not per-category-slug. The directive's per-category granularity is a real new dimension.

Two paths for Phase 6:

#### Path A — Add per-category overrides on top of existing state rules
- Keep `hemp_state_rules` as the default-by-state layer.
- Add a new table `state_compliance_overrides (category_slug, state_code, allowed, source, source_url, last_verified_at, notes)` for per-category exceptions only.
- Resolution order: per-category override → state default by `categories.requires_coa` mapping (intoxicating heuristic) → no row = "not verified, block by default".
- **Pros:** Doesn't churn the existing schema. Bake-in defaults stay correct. Per-category exceptions stay sparse.
- **Cons:** Two tables to reason about. Resolution logic is more code.

#### Path B — Replace with per-category matrix
- Build the directive's `state_compliance_matrix` from scratch.
- Migrate the 51 existing rows into the new shape, expanded by category (51 states × ~20 active categories = ~1000 rows).
- Update all the existing helpers + checkout + admin UI to read from the new table.
- **Pros:** Single source of truth.
- **Cons:** ~600 LOC of migration + helper changes + admin-UI refactor. Higher blast radius. Existing checkout integration is currently live; any regression hits paid orders.

**Recommendation:** Path A. Smaller PR, lower risk, preserves the working integration. Surface in GATE-15 for CEO approval if the per-category overrides need to be richer than I'm anticipating.

### Verification status — the bigger blocker

**0 of 51 rows have `last_verified_at` populated.** Whatever's in production is placeholder / unverified data that admin can write to. The PRE-LAUNCH compliance ask is: **fill these 51 rows with legally-defensible sources before any cannabinoid SKU goes public**. The dataset discussion below is for that population step.

---

## Public dataset candidates (ranked)

CEO directive: "best available public hemp legality dataset (Vicente Sederberg tracker or equivalent)." Below is what I can document from memory + general industry knowledge. Verifying any of these requires a CEO confirmation step before import.

### 1. Vicente Sederberg LLP — Hemp / Hemp-Derived Cannabinoid Map

- **What:** US state-by-state hemp legality tracker, maintained by Vicente Sederberg (cannabis-law specialty firm)
- **URL:** Historically published at `https://vicentellp.com/hemp-tracker/` or similar; verify currency
- **Format:** Web map + downloadable PDF/CSV
- **License:** Firm-published reference material. **Commercial use almost certainly requires written permission.** Direct ingestion as our DB layer → likely needs attribution + permission. CEO halt: confirm license before import.
- **Granularity:** Per-state, with notes on delta-8/9/THCA/etc. Aligns well with `hemp_state_rules` extended by `cannabinoid_type`.

### 2. National Hemp Association / US Hemp Roundtable

- **What:** Trade associations publishing state-tracker resources
- **License:** Membership material; redistribution generally restricted
- **Granularity:** State-level; sometimes weaker on intoxicating-cannabinoid sub-types

### 3. Cannabis Business Times / Hemp Industry Daily

- **What:** Editorial tracker, paywalled
- **License:** Commercial. Out of scope for free import.

### 4. State government primary sources (best long-term play)

- **What:** Each state's hemp regulations published on `.gov` sites
- **URL:** Patchwork (50 state websites)
- **License:** US government works are public domain (federal). State works generally not copyrighted in the legal sense — they're statutory text.
- **Granularity:** Authoritative. Slow to compile (~50 separate research items).
- **Approach for v1:** Start with the 10 states with highest expected order volume (CA, TX, FL, NY, CO, OR, WA, IL, OH, GA), document each rule with source URL + accessed_at, mark `last_verified_at`. Remaining 40 stay as `allows_delivery_*` = false (default-safe per migration comment).

### 5. Self-built: scrape + manual confirm

- **Tooling:** WebSearch / WebFetch + a structured form for admin to confirm each cell
- **License:** No third-party redistribution problem; primary-source cited per row
- **Time:** ~2-4 hours per state with careful sourcing
- **Recommendation for v1:** Combine #4 + #5 — admin uses the existing `app/admin/compliance/state-rules/` UI to populate rows one state at a time, citing `.gov` primary sources.

---

## Phase 6 implementation plan (high-level — to be expanded post-smoke-pass)

Given the brownfield:

**PR-K (data + types):**
- Migration: add `state_compliance_overrides` table (Path A) OR extend `hemp_state_rules` with `cannabinoid_type` column.
- Document the resolution-order helper that combines state defaults with overrides.

**PR-L (enforcement):**
- New `lib/compliance/regional.ts` with `canShipTo(productId, stateCode)` returning `{ allowed, reason, source }`.
- Product browse: warning banner (NEW work — current implementation hard-blocks at checkout but doesn't warn earlier).
- Cart: warning on add (NEW).
- Checkout: HARD BLOCK with citation (already in PR-B path — extend with source URL display).
- Vendor product creation: `ship_to_states` suggester (NEW).

**PR-M (admin UI):**
- Existing admin compliance UI extended with per-category override editor + audit log.
- Existing UI does NOT log changes today — adding a small `admin_action_logs` insert per write would close the audit gap.

**PR-N (tests):**
- Unit tests on resolution-order helper
- Integration test: anonymous browse from TX with delta-9 in cart → checkout blocks
- Admin UI permission tests

**Big banner copy** (per directive): "Compliance data is informational only, not legal advice. Last verified: <date>. Vendors are responsible for confirming legality of their shipments." Render on the admin page + linked footer everywhere a compliance decision is shown.

---

## CEO ask before Phase 6 starts (one decision)

**Question:** Path A (additive overrides) vs Path B (rewrite matrix)?

My recommendation: **Path A.** Smaller change, preserves working code, stays focused on populating the dataset which is the actual scarce resource. Confirm and Phase 6 PR-K kicks off with that shape.

**Dataset sourcing approach:**

My recommendation: **state-by-state primary-source population (option 4 + 5 combined)**, sequenced by order-volume priority. Reasoning:
- Avoids licensing question entirely
- Citations are inherently defensible in audit
- Existing admin UI already supports the workflow

If CEO prefers a faster start by licensing a third-party dataset (Vicente Sederberg), surface it as a procurement decision — the import would still flow through the existing admin write path.

---

## Files I did NOT inspect deeply yet

Will read at Phase 6 PR-K time, not during planning:
- `lib/server/deliveryStateRules.ts`
- `lib/compliance/getRestrictedStatesForProduct.ts`
- The admin compliance state-rules sub-page UI

Documented gap so the planner doesn't claim more knowledge than they have.
