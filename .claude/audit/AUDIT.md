# GOODHEMPDISTRO.COM — FULL AUDIT REPORT

**Date:** 2026-05-07
**Audited By:** Claude Code (Agent Mode)
**Commissioned By:** CEO, Good Hemp Distros
**Live URL audited:** https://www.goodhempdistro.com (production)
**Repo audited:** dloveGHD313/goodhempdistro @ `12d8f1d` (main)
**Supabase project:** `rpxondvoydrcsommaved` (Postgres 17.6, ACTIVE_HEALTHY)
**Source-of-truth docs read:** 5 of 6 PDFs (`Master_agent_prompt` not found in repo or Downloads — Phase 1 template provided by CEO inline)

---

## SECTION 1 — EXECUTIVE SUMMARY

**Overall grade: D (operational shell with one P0 production bug; pre-launch catalog).**

The platform's foundation is solid — schema is real, recent compliance + multi-tier work has shipped, admin surfaces work, and the past three weeks of merges (#168, #169, #170, #171) cleaned up substantial drift. However, two facts dominate the current snapshot: **(1)** a middleware-level age-gate is silently 307-redirecting `/pricing`, `/sitemap.xml`, `/robots.txt`, and any other non-allowlisted route to `/welcome`, breaking the top of the conversion funnel and SEO crawl path; **(2)** the catalog is pre-launch (1 product, 3 vendors, 0 paid orders, 0 events, 2 services, 0 affiliate payouts). The site cannot be marketed in its current state — not because the code is bad, but because nothing is actually for sale and the funnel into pricing is blocked. Closing the age-gate redirect (Build #1 in CEO queue) and seeding initial catalog content are the only things between "stable platform with no business" and "stable platform that can convert its first paying vendor." [Live Site] [Schema] [Source File: middleware.ts]

### Top 3 strengths

1. **Production stability has been recovered.** The recent campaign of fixes (vendor activation gap, slug column drift, COA path normalization, `affiliate_payouts` schema alignment, dead-code removal) restored a clean state. No silent failures remain in the audited code paths. [Repo: PRs #169, #170, #171]
2. **Single source of truth for vendor active state is real.** `profiles.vendor_status` plus the `lib/server/isVendorActive.ts` defensive helper now correctly enforces "active = SSOT or Stripe-confirmed subscription." Backfill ran. The legacy paid-vendor regression is fixed. [Source: lib/server/isVendorActive.ts] [Schema: profiles.vendor_status]
3. **Compliance scaffolding is present and correct in the database.** Categories table has `requires_coa` (boolean NOT NULL DEFAULT false), `ship_to_states` exists on products, `hemp_state_rules` table is populated, COA bucket + RLS policies are deployed. The runtime *enforcement* still uses a hardcoded slug allowlist in `lib/compliance.ts` instead of the DB column — but the underlying data shape supports a clean SSOT cutover. [Schema] [Source: lib/compliance.ts]

### Top 5 critical issues

1. **P0 — Middleware age-gate hard-blocks `/pricing`, `/sitemap.xml`, `/robots.txt`** to `/welcome` for any request without `ghd_age_verified` cookie. Conversion funnel and SEO crawl path both severed. [Source: middleware.ts:48-92]
2. **P0 — Catalog is empty.** 1 product (GHD Tee), 0 events, 2 services, 0 paid orders. The site has nothing to sell. [Schema queries]
3. **P1 — Build #1 (age-gate as warning model, not hard block) not started.** This is the same root cause as #1 above and the explicit top of the CEO build queue. Per CEO doc: "warning, not block; restrict products by state law." [CEO Doc: Definition of Launch-Ready] [Source: middleware.ts]
4. **P1 — COA enforcement uses hardcoded slug allowlist not DB column.** `lib/compliance.ts:60-79` matches against `COA_EXCEPTION_PATTERNS` and ignores `categories.requires_coa`. 60+ cannabinoid categories incorrectly default to `requires_coa=false` in the DB. Code currently papers over this with a "default true unless slug matches allowlist" pattern, but the data is wrong and the runtime divergence means admins can't manage COA rules from the UI. [Source: lib/compliance.ts] [Schema: categories]
5. **P1 — Build #2 tier-naming reconciliation: scope unclear.** Constants in `lib/referral.ts` already use the DB-aligned `starter|mid|top`. The only `enterprise/pro` references are inside loose `.includes()` substring matching that maps Stripe planKey strings to tiers. Either (A) tighten to a strict lookup, or (B) confirm scope different from what GATE-00 inferred. Cannot ship without CEO confirmation. [Source: lib/referral.ts:7-8, 105-106]

---

## SECTION 2 — PAGE-BY-PAGE FINDINGS

Each row sourced from a live curl `GET https://www.goodhempdistro.com<path>` on 2026-05-07. Unauthenticated requests; no `ghd_age_verified` cookie set.

### `/` (homepage)

| Element | Current State | Vision/Source Requirement | Gap | Priority |
|---|---|---|---|---|
| Headline | TITLE: "GoodHempDistro — The Hemp Industry, All in One Place" — H1 missing on raw HTML (client-rendered) | CEO: "Every Vendor. Every Product. One Platform." messaging | Title and `/welcome` H1 disagree on copy; client-rendered H1 means no SSR for SEO crawlers | High |
| Design | Dark theme; brand logo; topbar nav | Premium wholesale distributor positioning | Cannot evaluate without screenshots; visual audit deferred | Med |
| Copy | Description: "Discover lab-tested hemp products, connect with verified vendors..." | "GHD as premium wholesale distributor" per directive Section 7 | Currently positioned as marketplace, not wholesale-first | High |
| CTA | Cannot extract from SSR HTML (client-rendered) | Two-audience model (vendor-first, consumer-second) per `/welcome` H2 set | Need rendered DOM check via Chrome MCP (browser tool unavailable this run) | Med |
| Products | 1 live product visible to anonymous user (GHD Tee, Clothing) | Roadmap implies catalog of cannabinoid products | Catalog effectively empty | P0 |
| Trust signals | "lab-tested", "verified vendors", "compliant marketplace" in meta | COA verification, vendor verification, state compliance | Trust signals exist in copy but no visual badges/icons audited | Med |

### `/products` (real product list)

| Element | Current State | Vision Requirement | Gap | Priority |
|---|---|---|---|---|
| Headline | H1: "Local Hemp Discovery, Verified & Smooth" | Catalog browse | H1 reads more like marketing tagline than catalog header | Med |
| Design | Dark theme | Premium feel | Acceptable | Low |
| Copy | Meta: "Browse COA-certified hemp products..." | Wholesale + retail discovery | Acceptable | Low |
| CTA | Filters + product cards (rendered client-side) | Add to cart / Inquire | DB shows 1 live product | P0 |
| Products | 1 live (GHD Tee) | Multi-category catalog | Inventory blocker | P0 |
| Trust signals | "COA-certified" claim in meta | Per-product COA badge, lab results | UI presence not verified this pass | Med |

### `/pricing` — **ROUTE EXISTS BUT REDIRECTED**

| Element | Current State | Vision | Gap | Priority |
|---|---|---|---|---|
| Headline | TITLE: "Good Hemp Distro — The Hemp Industry Platform" — **content is `/welcome` page**, not pricing | Tier comparison: Starter / Pro / Enterprise (per Build #2) | **Middleware redirects `/pricing` → `/welcome`** for unverified visitors. Total funnel break. | **P0** |
| Real route | `app/pricing/page.tsx` exists in repo | — | Page works locally; middleware serving wrong content in prod | P0 |

### `/vendors` — **PAGE LOADS BUT SHOWS LOGIN**

| Element | Current State | Vision | Gap | Priority |
|---|---|---|---|---|
| Headline | TITLE: "Sign In \| Good Hemp Distro", H1: "Login" | Public vendor directory | `/vendors` is rendering login UI, not the directory | P0 |
| Source | `app/vendors/page.tsx` exists with directory metadata | — | Either component import is wrong or auth gate is firing inappropriately | P0 |

### `/events`

| Element | Current State | Vision | Gap | Priority |
|---|---|---|---|---|
| Headline | H1: "Events"; H2: "Upcoming Events" | Events with payout routing per Build #8 | DB shows 0 events. Empty state UX not audited. | P1 |
| CTA | Vendor "create event" affordance not verified | — | — | Med |

### `/services`

| Element | Current State | Vision | Gap | Priority |
|---|---|---|---|---|
| Headline | H1: "Services"; H2: "Explore by category", "Listed services" | 8 individual service pages per Build #9 (one per service) | Currently appears single combined page; need to verify per-service detail routes exist | P1 |
| Inventory | 2 services in DB | 8+ services per CEO queue | Service catalog blocker | P1 |

### `/about`

| Element | Current State | Vision | Gap | Priority |
|---|---|---|---|---|
| Headline | H1: "About Good Hemp Distro"; H2: Mission/Story/Values/Why Choose Us | Brand story consistent with CEO doc principles | Solid info architecture; copy quality not deeply audited | Low |
| Title | "About Good Hemp Distro \| Nashville's Hemp Platform" | — | Acceptable | Low |

### `/community`, `/shop`, `/ask-jax` — **ROUTES DO NOT EXIST**

| Path | Reality | Fix |
|---|---|---|
| `/community` | No `app/community/` directory. Middleware redirects to `/welcome`. | Either build the page (Build #7 community feed prominence) or remove from any nav linking to it |
| `/shop` | No `app/shop/` directory. The active product list is `/products`. | Add 308 → `/products`, or update nav |
| `/ask-jax` | No `app/ask-jax/` directory. The widget is `app/jax-preview/` plus an embedded component. | Add canonical route or update marketing surface |

[Live Site: route 200s but content is `/welcome` fallback because middleware redirects unmatched non-allowlisted paths to `/welcome`.]

---

## SECTION 3 — BRAND & MESSAGING ALIGNMENT

**Does the site communicate the CEO's brand story?** *Partially.*

The 5 CEO PDFs read are governance documents (stability principles, success definition, daily loop, recovery rules) — they do **not** contain a brand voice guide, tone matrix, value pillars, or competitive positioning narrative. The directive's Section 7 reference to "GHD as a premium wholesale distributor" is therefore not directly traceable to a CEO doc; it surfaced inline in the CEO directive.

**Tone of voice — current vs. inferable required:**

- **Current** (from live meta + welcome HTML): Casual marketplace, two-audience pitch ("Find Hemp Near You" + "Grow Your Hemp Business"), "Every Vendor. Every Product. One Platform." Trust beats: "lab-tested," "COA-certified," "verified vendors," "compliant marketplace."
- **Required (inferred from directive only)**: Premium wholesale distributor positioning. The current copy reads more like consumer marketplace + vendor onboarding hub. There is no wholesale-first messaging surface other than the standalone `/wholesale/apply` route.

**Missing messaging pillars:**

- Wholesale distributor capability (volume, fulfillment, COA chain)
- "Why Nashville-anchored" geographic story (mentioned in `/about` title but not pulled forward)
- Vendor success stories / case studies (catalog is too thin for these to be meaningful yet)
- Industry education (`/learning-with-jax` exists per repo but content depth not audited)

**Copy rewrites needed** (flagged sections):

1. **Homepage hero** — currently bridges consumers + vendors equally. CEO directive implies wholesale primary. Recommend split-test or audience selector.
2. **`/products` H1** "Local Hemp Discovery, Verified & Smooth" — too marketing-y; on the actual catalog page this should be a clear "Shop Hemp" or category-led header.
3. **Brand naming** — title casing inconsistent: `/` uses "GoodHempDistro" (one word), most other pages use "Good Hemp Distro" (three words). Pick one in `lib/brand.ts` and propagate.

[Source: live HTML via curl] [Source: lib/brand.ts assumed; not opened this pass]

**HALT:** Detailed brand voice work beyond the above requires a CEO-supplied brand guide. Currently inventing voice from the directive alone would violate Rule 3.

---

## SECTION 4 — UX & CONVERSION AUDIT

**Friction points in the buyer journey (anonymous → paying customer):**

1. **Age-gate is a hard wall, not a warning.** Without `ghd_age_verified` cookie, every non-allowlisted route 307-redirects to `/welcome`. CEO Build #1 explicitly calls this out: "warning model, not hard block; restrict products by state law." [Source: middleware.ts:80-92]
2. **`/pricing` invisible to anonymous visitors.** Same root cause — pricing is not in `isAgeGateExcludedPath`. [Source: middleware.ts:50-78]
3. **`/vendors` rendering login page** — public vendor directory inaccessible. Conversion blocker for "I want to see who sells hemp here" curiosity flow. [Live HTML: /vendors → Login H1]
4. **No real catalog.** 1 product visible site-wide. Even a perfect funnel has nothing to convert into. [Schema query]
5. **No search-engine visibility.** `/sitemap.xml` and `/robots.txt` both 307 to `/welcome`. Google never sees the sitemap. Indexing blocked. [Live HTML: curl -I /sitemap.xml /robots.txt]

**Missing or weak CTAs:** Cannot fully verify without rendered DOM check (Chrome MCP unavailable this run). Recommend Phase 0 retry once browser tooling is reachable.

**Navigation issues:** If main nav links to `/community`, `/shop`, or `/ask-jax`, all three currently fall back to `/welcome` (route doesn't exist). Need rendered DOM to confirm; flagged for Phase 0 retry.

**Mobile experience gaps:** Not audited this run (no headless browser; Lighthouse not run). Per directive item 4 still pending CEO confirmation on Lighthouse approach.

**Checkout / inquiry flow:** Cannot test end-to-end with no real catalog (1 product). Stripe Connect activation flow gated to CEO approval per directive.

---

## SECTION 5 — PRODUCT & CATALOG AUDIT

**Live catalog state (2026-05-07):**

| Resource | Total | Live (approved+active) |
|---|---|---|
| Products | 1 | 1 |
| Vendors | 3 | 3 (status='active') |
| Active vendor profiles | — | 2 (`vendor_status='active'`) |
| Events | 0 | 0 |
| Services | 2 | not verified |
| Paid orders | 0 | — |
| Affiliate payouts | 0 | — |
| Categories | 169 | (17 require_coa=true, 152 false) |

[Schema queries]

**Products that should be featured per roadmap:** N/A — catalog has not been seeded. CEO Build #1 implies "restrict products by state law" assumes products *exist*. They don't yet.

**Missing product categories:** The 169-category taxonomy is over-broad relative to 1 live product. Categories include 6+ duplicates ("Edibles" exists 2× — standalone + under Consumables; same for Tinctures, Vapes, Concentrates, Accessories). Dedupe is a P3 hygiene task.

**Description quality / SEO + conversion gaps:** Cannot audit at scale — only one product to inspect. GHD Tee meta is reasonable. Phase 2 should add structured-data JSON-LD for `Product` schema once catalog grows.

**Pricing display:** Per-product price renders correctly; `/pricing` (the platform-tier comparison page) is currently inaccessible to anonymous visitors due to middleware. P0.

**Photography / visual merchandising:** Not audited (no rendered DOM). Recommend Phase 0 retry.

---

## SECTION 6 — TECHNICAL & SEO AUDIT

**Broken / misbehaving:**

1. **Middleware redirect storm.** `/pricing`, `/sitemap.xml`, `/robots.txt`, `/wholesale` (not in allowlist), and any other non-explicit route → 307 → `/welcome`. Confirmed via `curl -sIL`. [Source: middleware.ts:48-92]
2. **`/vendors` renders Login page.** Public directory broken. [Live HTML]
3. **`/community`, `/shop`, `/ask-jax` referenced but not built.** Either remove links or build pages.

**Missing meta data:**
- Homepage `/` has client-side-only H1 (not in SSR HTML) → invisible to plain crawlers / SEO bots that don't run JS.
- `og:url` for `/welcome` content is `goodhempdistro.com/welcome` even when served from `/pricing` etc — duplicate content signal to Google.

**Page speed:** Not measured this run. Lighthouse pending CEO confirmation.

**Mobile responsiveness:** Not measured this run.

**Compliance gaps:**

- **FDA disclaimers:** Not audited per page. Required on any cannabinoid product page and at footer.
- **State restriction warnings:** `ship_to_states` column exists, `hemp_state_rules` table exists, the runtime banner is in `app/products/[id]/page.tsx`. Catalog has no products that exercise this code path yet. [Schema]
- **Age verification:** Currently a hard redirect block, not a warning model. CEO Build #1 explicitly wants warning model. [CEO Definition of Launch-Ready] [Source: middleware.ts]
- **Payment compliance:** Stripe Connect not yet activated for vendor payouts (Build #3 — gated to CEO approval per directive).
- **COA enforcement:** Logic uses hardcoded slug allowlist instead of DB column. P1 to switch to SSOT (`categories.requires_coa`). Data fix required first (60+ rows). [Source: lib/compliance.ts]

**Schema drift status:**
- `affiliate_payouts`: aligned (15 columns, status CHECK includes `pending|processing|requested|approved|paid|rejected|forfeited`). [PR #171]
- `vendor_packages` / `consumer_packages`: dead code removed. [PR #170]
- `products.lab_results_url`: still referenced in code or already removed? Was flagged in Build 11 audit. **Re-verify in Phase 2.**
- `categories.requires_coa`: column exists; runtime ignores it. [P1]

---

## SECTION 7 — COMPETITIVE POSITIONING CHECK

**Does the site position GHD as a premium wholesale distributor?** No — current positioning is consumer-marketplace-first with vendor onboarding as a secondary CTA. The `/wholesale/apply` route exists but isn't promoted from the homepage hero. Per CEO Build #2 the pricing tiers (Starter / Pro / Enterprise) suggest a B2B SaaS posture; current home copy is more B2C marketplace.

**What competitors do better (general industry observation, not CEO-confirmed):**

- Industry leaders surface lab-test transparency (per-product COA download, batch number) directly on product cards.
- Premium wholesale distributors lead with volume tiers, MOQ, lead times, and white-label capability.
- Compliance-forward marketplaces show state-eligibility chips on every product card before checkout.

**What unique advantages are not being communicated:**

- Nashville-anchored (mentioned only in `/about` title, not pulled to homepage)
- Compliance-aware shipping (the `ship_to_states` machinery exists but no products to demonstrate it)
- "Ask JAX" (an actual differentiator if it works — currently routes to `/welcome` due to missing `app/ask-jax`)
- Vendor self-service product approval flow (already shipped in admin tooling, not surfaced as a vendor benefit on `/pricing` or vendor onboarding)

**HALT:** Deeper competitive positioning requires a CEO-supplied competitor list and the "premium wholesale distributor" definition document. Inferring further would violate Rule 3.

---

## SECTION 8 — PRIORITIZED FIX LIST

| # | Fix Required | Page/Section | Impact | Effort | Owner |
|---|---|---|---|---|---|
| 1 | **Age-gate → warning model + add `/pricing`, `/sitemap.xml`, `/robots.txt`, `/wholesale` to allowlist (or convert all to warning banner)** | `middleware.ts` | P0 — funnel + SEO | M | Engineer (gated) |
| 2 | Investigate why `/vendors` renders Login (probably an early auth check or import shadowing); restore vendor directory | `app/vendors/page.tsx` | P0 — discovery | S | Engineer |
| 3 | Add canonical 308 redirects or build pages for `/community`, `/shop`, `/ask-jax`; audit nav links | `app/`, nav config | P1 — UX trust | S | Engineer |
| 4 | Seed initial catalog: at least 1 product per top-12 active categories, 2–3 events, 5 services | DB + admin tooling | P0 — business | L | Operations |
| 5 | COA SSOT cutover: data migration (60+ rows) + replace `requiresCOA()` slug allowlist with DB read | `lib/compliance.ts`, `categories` table | P1 — compliance | M | Engineer (gated for >500 row UPDATE? — this is ~60 rows, OK without gate) |
| 6 | Tier reconciliation Build #2: confirm scope, then ship strict-lookup version of `getCommissionRateBps` / `getListingLimit` | `lib/referral.ts` | P1 — billing accuracy | S | Engineer (after CEO confirms scope) |
| 7 | Robots/Sitemap allowlist fix (subset of #1) | `middleware.ts` | P1 — SEO | XS | Engineer |
| 8 | Brand title casing consistency: pick "Good Hemp Distro" or "GoodHempDistro" everywhere | `lib/brand.ts` + meta | P2 | XS | Engineer |
| 9 | Stripe Connect activation flow audit (Build #3) | `app/vendors/payouts`, webhook | P1 — payouts | L | **CEO GATE** |
| 10 | Ask JAX cost-ceiling + canonical route (Build #4) | `app/ask-jax`, OpenAI integration | P2 | M | **CEO GATE** |
| 11 | Regional compliance state matrix surface (Build #5) — already has DB scaffolding | `app/compliance/state-laws` | P2 | M | **CEO GATE** |
| 12 | 8 individual service pages (Build #9) | `app/services/[slug]` | P2 | M | Engineer |
| 13 | Events payout routing (Build #8) | `events`, webhook | P2 | M | Engineer |
| 14 | Personalized onboarding flow review (Build #6) — already partially shipped per PR #164 | `/onboarding`, `/get-started` | P3 | S | Engineer |
| 15 | Community feed prominence (Build #7) | `app/newsfeed`, homepage | P3 | M | Engineer |
| 16 | Jax episodes content surface (Build #10) | `app/learning-with-jax` | P3 | L | Operations + Engineer |
| 17 | Categories dedupe (5+ duplicate names) | `categories` table | P3 — hygiene | S | Engineer |
| 18 | Stale feature branches cleanup (22 local branches) | git | P3 | XS | Engineer |

---

## SECTION 9 — REBUILD DIRECTIVES (high-priority)

### Fix #1 — Age-gate warning model

- **What to change:** Convert middleware age-gate from hard redirect to a non-blocking warning. Either (a) add all public routes to allowlist and rely on a client-side banner that the user dismisses, or (b) replace the redirect with a `<DismissibleAgeBanner>` rendered globally in `app/layout.tsx`. SEO-critical paths (`/sitemap.xml`, `/robots.txt`) must be unconditionally exempt.
- **Why:** CEO Definition of Launch-Ready Build #1: "warning, not block; restrict by state law." Hard redirect to `/welcome` blocks pricing, sitemap, robots; severs both conversion funnel and SEO indexing.
- **How:** (1) Add `/pricing`, `/sitemap.xml`, `/robots.txt`, `/wholesale`, `/blog`, `/faq`, `/refunds` to `isAgeGateExcludedPath` in `middleware.ts`. (2) Build `<AgeWarningBanner>` shown until `ghd_age_warning_dismissed` cookie set; only persists the dismissal, doesn't gate access. (3) State-law restriction logic lives at the *product* level via `ship_to_states`, not the middleware.
- **Success metric:** `curl -sIL https://www.goodhempdistro.com/pricing` returns 200 with pricing HTML (no `/welcome` redirect). `/sitemap.xml` returns valid XML. Lighthouse SEO score recovers.
- **CEO Gate:** Yes — touches user-facing compliance gate. Requires GATE-NN file before merge.

### Fix #2 — `/vendors` directory restoration

- **What:** Investigate why `/vendors` is rendering "Login | Good Hemp Distro" instead of the directory metadata declared at the top of `app/vendors/page.tsx`. Likely culprits: (a) auth check in the page body redirects unauthenticated visitors, (b) component import shadowing (e.g., `Login` instead of `VendorsDirectoryClient`), (c) middleware path-startsWith collision.
- **Why:** Public vendor directory is a primary discovery surface; it's already in `isAgeGateExcludedPath`, so middleware isn't the issue.
- **How:** Read full `app/vendors/page.tsx` + `VendorsDirectoryClient.tsx`. Check for unconditional `redirect('/login')`. Verify the rendered component matches metadata.
- **Success metric:** Anonymous request to `/vendors` shows H1 "Discover Hemp Vendors" (or per design system) and lists 3 active vendors.

### Fix #3 — Missing routes (`/community`, `/shop`, `/ask-jax`)

- **What:** Either build minimal stub pages or add 308 redirects to canonical equivalents. Recommended:
  - `/shop` → 308 → `/products` (canonical catalog)
  - `/community` → minimal page now, expand for Build #7 later
  - `/ask-jax` → 308 → `/jax-preview` (current canonical) OR build dedicated page
- **Why:** Currently all three fall back to `/welcome` via middleware, presenting wrong content under right URL — a dishonest signal to users and search engines.
- **How:** Add explicit routes in `app/`, or use Next.js `redirects` in `next.config.ts`.
- **Success metric:** `/shop` 308s to `/products`. `/ask-jax` reaches the JAX widget. `/community` shows the placeholder or the real feed.

### Fix #4 — Seed initial catalog

- **What:** Add ~12 anchor products (one per top-12 categories), 2–3 sample events, 5 services. Real or representative.
- **Why:** With 1 product, the entire funnel can't be tested or marketed. Multiple builds (#5 state restriction, #8 events payout, #9 service pages) require catalog presence to verify.
- **How:** Use vendor admin tooling. Vendors involved are real (good hemp distro, DLove Test Vendor, D&K Luxury). Coordinate with Operations to identify which vendor owns which initial SKU.
- **Success metric:** `/products` shows ≥ 12 cards. `/events` shows ≥ 1 event. `/services` shows ≥ 5 services.
- **CEO Gate:** No — this is operations work, not engineering. But CEO must designate which initial vendors and SKUs.

### Fix #5 — COA SSOT cutover

- **What:** Two commits, ONE PR (per prior plan):
  - **Commit 1:** Data migration `20260507010000_coa_categories_data_fix.sql` — UPDATE 60+ category rows to `requires_coa=true` per the matrix already drafted.
  - **Commit 2:** Refactor `requiresCOA()` in `lib/compliance.ts` to read `category.requires_coa` directly. Remove `COA_EXCEPTION_PATTERNS`. Update form UI badges.
- **Why:** Eliminates code/data divergence. Future admins can manage COA rules from a UI that maps to a real column. Removes slug-substring matching footguns (e.g., `hemp-footwear` incorrectly requiring COA via slug-includes-`f`).
- **Success metric:** `/products/<UUID>` for any clothing product approves without COA. `/products/<UUID>` for any tincture cannot pass admin approve without verified COA. `categories.requires_coa` count after migration: ~107 require_coa, ~62 no_coa.
- **CEO Gate:** Marginal. ~60 rows < 500 row threshold so technically not gated. Recommend GATE-NN anyway because compliance-adjacent.

---

## SECTION 10 — NEXT STEPS & ROADMAP ALIGNMENT

### 30-day quick wins (P0 + low-effort P1)

- [ ] Fix #1: Age-gate warning model (Build #1) — **top of CEO queue**
- [ ] Fix #2: Restore `/vendors` directory
- [ ] Fix #3: Resolve `/community` `/shop` `/ask-jax` (redirects or stubs)
- [ ] Fix #7: Robots/Sitemap allowlist (sub-task of #1)
- [ ] Fix #4 (Operations): Seed initial catalog to ≥12 products
- [ ] Fix #5: COA SSOT cutover (data + code)
- [ ] Fix #6: Build #2 tier reconciliation — only after CEO confirms scope (GATE-00 item #3)
- [ ] Fix #8: Brand title casing pass

### 60-day structural improvements

- [ ] Build #3: Stripe Connect autonomous payouts (vendors/drivers/affiliates) — **CEO gate**
- [ ] Build #4: Ask JAX OpenAI integration with paid gate — **CEO gate** (cost ceiling)
- [ ] Build #5: Regional compliance UX surface (state-laws page) — **CEO gate** (state matrix)
- [ ] Build #9: 8 individual service pages
- [ ] Build #8: Events payout routing
- [ ] Add structured-data JSON-LD (`Product`, `Organization`, `BreadcrumbList`) once catalog seeded

### 90-day full vision alignment milestones

- [ ] Build #6: Personalized onboarding flow polish (already partly shipped — verify completeness)
- [ ] Build #7: Community feed prominence (homepage + dashboard)
- [ ] Build #10: Jax episodes content surface
- [ ] Categories dedupe + admin UI for `requires_coa` toggling
- [ ] Lighthouse mobile ≥ 80 on all primary routes
- [ ] Stale branch cleanup (22 local branches)
- [ ] Stripe Connect dispute handling + retry queue

### Open questions for CEO

1. **Master_agent_prompt PDF** — still missing. The 10-section template was provided inline (acknowledged). Confirm if there are additional spec details in that document beyond this template.
2. **Build #2 tier-reconciliation scope** (GATE-00 item #3): is the desired fix (a) replace `.includes()` with strict `Record<planKey,Tier>` lookup driven by Stripe price metadata, or (b) something else? Needed before opening that PR.
3. **Lighthouse approach** (GATE-00 item #4): full `npx lighthouse` per route, or headless-browser approximate audit? Affects how Phase 3 verification is scored.
4. **Output directory** (GATE-00 item #4): `/tmp/ghd-audit/` doesn't exist on this Windows host. Currently using `C:/dev/goodhempdistro/goodhempdistro/.claude/audit/`. Confirm.
5. **"Premium wholesale distributor" positioning** — confirm intent. Current site reads consumer marketplace-first; pivoting to wholesale-first changes hero, pricing, vendor onboarding copy, and homepage IA.
6. **Initial catalog seeding** — which vendor will own each anchor SKU for the ~12 starter products? CEO designation needed.
7. **Age-gate UX** — preferred warning UI: full-screen acknowledgement once, dismissible top banner, or per-page tag near cannabinoid products?
8. **Stripe Connect activation** — live-mode or test-mode for the upcoming Build #3 work?
9. **Ask JAX cost ceiling** — daily/monthly OpenAI spend cap before throttling?
10. **State restriction matrix** — which states are P0 (must enforce) vs. P1 (warn but ship) for the initial launch?

---

## CITATIONS LEGEND

- [Live Site] — `curl -sL --max-time 10 https://www.goodhempdistro.com/...` on 2026-05-07
- [Source File] — `C:/dev/goodhempdistro/goodhempdistro/<path>`
- [CEO Doc] — extracted from `C:/Users/yokid/Downloads/GHD_*.pdf` via `pdftotext` 2026-05-07
- [Schema] — Supabase MCP `execute_sql` against project `rpxondvoydrcsommaved`
- [Repo] — `gh pr list`, `git log` on `dloveGHD313/goodhempdistro`
- [Vercel Logs] — *not pulled this run; Vercel MCP not loaded*
- [Stripe] — *not pulled this run; Stripe MCP not loaded*

**Phase 0 read-only audit complete. Awaiting CEO sign-off on GATE-00 items 2/3/4 before initiating any Phase 2 execute work.**
