# Recreational Alignment Audit Report

## A) Executive Summary

| Area | Status | Reason |
|------|--------|--------|
| **Products** | PASS | Market Switcher labels come from `getMarketDisplayName()` (Recreational only). ProductsList uses mode `RECREATIONAL` and copy "recreational market". Filter logic and gated checks use RECREATIONAL; legacy INTOXICATING accepted in DB reads and normalized for display. |
| **Discover** | PASS | No market filter UI; page has no market/category switcher or legacy copy. |
| **Feed** | PASS | No market filter UI; FeedExperience has no market-related labels. |
| **Vendor create/edit** | PASS | Product type option label is "Recreational"; user-facing messages say "Recreational products". DB value `intoxicating` remains for schema only; not rendered as label. |
| **Admin/moderation** | PASS | Compliance table header "Recreational Ack"; no "Intoxicating" in UI. Admin id-verifications and other dashboards have no market filter copy. |
| **Search/facets** | Not present | No search indexing or facet system for market in this app. |
| **Backend/API normalization** | PASS | `normalizeMarket()` in `lib/markets.ts` is the single normalization helper. Gated checks treat both `RECREATIONAL` and `INTOXICATING` (legacy DB value). No API accepts raw market filter param; profile/product reads use existing logic that normalizes via marketMode and markets lib. |
| **Tests/guardrails** | PASS | `__tests__/markets.test.ts` covers normalization (intoxicating/psychoactive/intoxicated → RECREATIONAL) and UI guardrail scan (no Intoxicating/Intoxicated/Psychoactive in app/components .tsx except allowed identifiers). |

---

## B) Canonical Rules (what must be true)

- **Canonical internal value (market):** `RECREATIONAL` (TypeScript/DB). Legacy DB value `INTOXICATING` is accepted on read and treated as gated/recreational; migration 065 migrates stored data to RECREATIONAL.
- **Legacy inputs that must normalize to recreational:** `intoxicating`, `psychoactive`, `intoxicated`, `INTOXICATING` (and case variants). Handled by `normalizeMarket()` in `lib/markets.ts`.
- **UI must render none of:** "Intoxicating", "Intoxicated", "Psychoactive". All user-facing labels use "Recreational" or "Non-recreational" via `getMarketDisplayName()` / `MARKET_DISPLAY_NAMES`.

---

## C) File-by-file Change Log

**lib/markets.ts**  
- **Area:** Shared  
- **What it controls:** Single source of truth for market display names and normalization.  
- **Before:** N/A (created for alignment).  
- **After:** Exports `RECREATIONAL`, `MARKET_DISPLAY_NAMES`, `normalizeMarket()`, `getMarketDisplayName()`, `isRecreationalCategory()`, `toDbMarket()`, `fromDbMarket()`. All legacy inputs normalize to RECREATIONAL; display label for gated is always "Recreational".  
- **Why:** Canonical rules require one normalization helper and one UI label mapping.  
- **Verification:** Grep for normalizeMarket/getMarketDisplayName usage; tests assert normalization and label content.

**lib/marketMode.ts**  
- **Area:** Products, Shared  
- **What it controls:** Market mode context (CBD_WELLNESS, INDUSTRIAL, SERVICES, RECREATIONAL); persistence and profile sync.  
- **Before:** Used `INTOXICATING` in type and VALID_MODES.  
- **After:** Type is `MarketCategory`; `VALID_MODES` includes `RECREATIONAL`; `normalizeMode()` uses `normalizeMarket()` so INTOXICATING/GATED normalize to RECREATIONAL.  
- **Why:** UI and state must use RECREATIONAL; legacy profile/DB values normalized on read.  
- **Verification:** Grep shows RECREATIONAL only in mode type/array; no "Intoxicating" in UI path.

**components/market/MarketSwitcher.tsx**  
- **Area:** Products, UX  
- **What it controls:** Market switcher options and modal copy on products (and services) page.  
- **Before:** Option label "Intoxicating"; modal "Intoxicating Market is 21+".  
- **After:** Options built via `getMarketOptions()` using `getMarketDisplayName()`; fourth option value RECREATIONAL, label "Recreational"; modal "Recreational Market is 21+".  
- **Why:** UI must not render Intoxicating/Intoxicated/Psychoactive.  
- **Verification:** No string "Intoxicating" in file; label comes from lib/markets.

**app/products/page.tsx**  
- **Area:** Products  
- **What it controls:** Products list page; fetches products; passes data to ProductsList and MarketSwitcher.  
- **Before:** Derived market_mode with `market_category === "INTOXICATING"`.  
- **After:** Derives market_mode with `market_category === "RECREATIONAL" || market_category === "INTOXICATING"`.  
- **Why:** Backend may still return legacy value; both must be treated as gated.  
- **Verification:** Grep shows RECREATIONAL and INTOXICATING in condition; no UI string.

**app/products/ProductsList.tsx**  
- **Area:** Products  
- **What it controls:** Product grid, filter by mode, verification notice, chip labels.  
- **Before:** Mode check for INTOXICATING; copy "intoxicating market"; isIntoxicating for chip.  
- **After:** Mode is RECREATIONAL; copy "recreational market"; isRecreational; no "Intoxicating" in copy.  
- **Why:** UI must show Recreational only; legacy DB value still accepted for isRecreational.  
- **Verification:** Grep shows "recreational market"; isRecreational; RECREATIONAL in mode checks.

**app/products/[id]/page.tsx**  
- **Area:** Products  
- **What it controls:** Product detail page; gated vs full view.  
- **Before:** market_mode from `market_category === "INTOXICATING"`.  
- **After:** market_mode from `market_category === "RECREATIONAL" || market_category === "INTOXICATING"`; locked view CTA to /verify; no legacy words in copy.  
- **Why:** Gated detection must include legacy value; UI copy Recreational only.  
- **Verification:** Grep; locked view uses "Verify 21+ to Unlock" and /verify.

**app/discover/page.tsx**  
- **Area:** Discover  
- **What it controls:** Discover page content.  
- **Before:** No market filter.  
- **After:** Unchanged; no market filter or legacy copy.  
- **Why:** Discover does not expose market switcher/filters.  
- **Verification:** Grep shows no Intoxicating/Intoxicated/Psychoactive.

**app/newsfeed/page.tsx, app/newsfeed/FeedExperience.tsx**  
- **Area:** Feed  
- **What it controls:** Feed page and experience.  
- **Before:** No market filter.  
- **After:** Unchanged; no market copy.  
- **Why:** Feed has no market UI.  
- **Verification:** Grep shows no legacy words.

**app/vendors/products/new/page.tsx**  
- **Area:** Vendor  
- **What it controls:** New product form; product type dropdown.  
- **Before:** Option label "Intoxicating".  
- **After:** Option label "Recreational"; value remains "intoxicating" (DB); error/copy "Recreational products".  
- **Why:** UI must not show Intoxicating; product_type enum unchanged in DB.  
- **Verification:** Option text is "Recreational"; guardrail test allows value="intoxicating".

**app/vendors/products/[id]/edit/EditProductForm.tsx**  
- **Area:** Vendor  
- **What it controls:** Edit product form; product type dropdown.  
- **Before:** Option label "Intoxicating".  
- **After:** Same as new: label "Recreational"; value "intoxicating"; copy "Recreational products".  
- **Why:** Same as vendor new.  
- **Verification:** Same as above.

**app/vendor-registration/VendorForm.tsx**  
- **Area:** Vendor  
- **What it controls:** Vendor registration; policy ack.  
- **Before:** "Intoxicating Ack" / "intoxicating products" in copy.  
- **After:** recreationalAck state; copy "recreational products"; payload key intoxicating_policy_ack (DB column unchanged).  
- **Why:** UI copy Recreational only; DB column name unchanged per constraint.  
- **Verification:** Grep shows "recreational products"; header in admin is "Recreational Ack".

**app/admin/compliance/ComplianceClient.tsx**  
- **Area:** Admin  
- **What it controls:** Compliance table; column headers.  
- **Before:** Column "Intoxicating Ack".  
- **After:** Column "Recreational Ack"; property access remains vendor.intoxicating_policy_ack (DB).  
- **Why:** UI must not show Intoxicating.  
- **Verification:** Grep shows "Recreational Ack".

**app/admin/compliance/page.tsx**  
- **Area:** Admin  
- **What it controls:** Selects vendor fields including intoxicating_policy_ack.  
- **Before/After:** No UI string change; column name in query is DB schema.  
- **Why:** Schema not changed.  
- **Verification:** No user-facing "Intoxicating" in this file.

**app/api/checkout/create-session/route.ts**  
- **Area:** API  
- **What it controls:** Checkout session; gated product check.  
- **Before:** Gated from market_category === "INTOXICATING".  
- **After:** Gated from RECREATIONAL or INTOXICATING; uses requireMarketAccess (which uses requireGatedAccess).  
- **Why:** Backend must treat both as gated; no new legacy values created by API.  
- **Verification:** Grep shows RECREATIONAL and INTOXICATING in condition.

**app/api/favorites/route.ts**  
- **Area:** API  
- **What it controls:** Favorites; gated product flag.  
- **Before:** Gated when market_category === "INTOXICATING".  
- **After:** Gated when RECREATIONAL or INTOXICATING.  
- **Why:** Same as checkout.  
- **Verification:** Grep.

**app/api/vendors/create/route.ts**  
- **Area:** API  
- **What it controls:** Vendor creation; intoxicating_policy_ack.  
- **Before:** Error message referenced "Intoxicating products".  
- **After:** Error message "Recreational products policy acknowledgement...".  
- **Why:** API error messages are user-facing.  
- **Verification:** Grep shows "Recreational products".

**app/api/vendors/products/create/route.ts**  
- **Area:** API  
- **What it controls:** Product creation; product_type normalization.  
- **Before/After:** normalizeProductType() still maps "intoxicating" to "intoxicating" for DB (schema). No market_category in this flow.  
- **Why:** product_type enum unchanged; no market param.  
- **Verification:** No UI copy in API response.

**app/api/vendors/products/[id]/route.ts**  
- **Area:** API  
- **What it controls:** Product update; product_type.  
- **Before/After:** product_type passed through; no market_category.  
- **Why:** Schema unchanged.  
- **Verification:** No legacy market copy.

**app/account/favorites/page.tsx**  
- **Area:** Products  
- **What it controls:** Favorites list; market_mode for filtering.  
- **Before:** market_mode from market_category === "INTOXICATING".  
- **After:** market_mode from RECREATIONAL or INTOXICATING.  
- **Why:** Backend compatibility; no UI label for market in this page.  
- **Verification:** Grep.

**app/vendors/[id]/page.tsx**  
- **Area:** Products/Vendor  
- **What it controls:** Vendor public page; product list with gated flag.  
- **Before:** market_mode from INTOXICATING.  
- **After:** market_mode from RECREATIONAL or INTOXICATING.  
- **Why:** Same as above.  
- **Verification:** Grep.

**lib/server/marketGate.ts**  
- **Area:** API, Products  
- **What it controls:** isGatedProduct(); requireMarketAccess() / requireGatedAccess().  
- **Before:** isGatedProduct used market_category === "INTOXICATING".  
- **After:** isGatedProduct true for RECREATIONAL or INTOXICATING.  
- **Why:** Gate logic must treat both as gated.  
- **Verification:** Grep.

**app/verify/page.tsx, app/verify-age/page.tsx**  
- **Area:** UX  
- **What it controls:** Verify landing copy.  
- **Before:** "intoxicating products" / "intoxicating market".  
- **After:** "recreational products" / "recreational market".  
- **Why:** UI must not show Intoxicating.  
- **Verification:** Grep shows "recreational".

**app/onboarding/consumer/ConsumerOnboardingClient.tsx**  
- **Area:** UX  
- **What it controls:** Market preference options in onboarding.  
- **Before:** Type included INTOXICATING; MARKET_CHOICES had no Recreational option.  
- **After:** Type includes RECREATIONAL; MARKET_CHOICES has { value: "RECREATIONAL", label: "Recreational" }; descriptions "Non-recreational" where applicable.  
- **Why:** Onboarding must offer Recreational and never show Intoxicating.  
- **Verification:** Grep shows RECREATIONAL and "Recreational".

**__tests__/markets.test.ts**  
- **Area:** Tests  
- **What it controls:** Normalization and UI guardrail tests.  
- **Before:** N/A (added for alignment).  
- **After:** Tests for normalizeMarket (intoxicating/psychoactive/intoxicated → RECREATIONAL); getMarketDisplayName; MARKET_DISPLAY_NAMES (no legacy words in labels); UI scan: no app/components .tsx file may contain "Intoxicating"/"Intoxicated"/"Psychoactive" except in allowed patterns (getIntoxicating*, isIntoxicating*, intoxicating_policy, value="intoxicating").  
- **Why:** Regression guardrails per canonical rules.  
- **Verification:** npm run test -- __tests__/markets.test.ts passes.

**docs/markets-qa.md**  
- **Area:** UX / Docs  
- **What it controls:** QA checklist wording.  
- **Before:** INTOXICATING in checklist.  
- **After:** RECREATIONAL in checklist; Phase G skip noted; guardrail test referenced.  
- **Why:** Docs must reflect current behavior.  
- **Verification:** Grep.

**supabase/migrations/065_recreational_market.sql**  
- **Area:** Backend  
- **What it controls:** DB migration: products.market_category and profiles.market_mode_preference FROM INTOXICATING TO RECREATIONAL; constraints updated.  
- **Before:** N/A (new migration).  
- **After:** Existing rows updated to RECREATIONAL; new constraint allows RECREATIONAL only (no INTOXICATING).  
- **Why:** Canonical internal value in DB is RECREATIONAL; legacy data migrated.  
- **Verification:** Migration file review; app still accepts INTOXICATING on read for backward compatibility until migration applied.

**supabase/migrations/005_compliance_logistics.sql, 048_markets_4way.sql**  
- **Area:** Backend  
- **What it controls:** product_type enum ('non_intoxicating', 'intoxicating', 'delta8'); vendors.intoxicating_policy_ack; earlier market constraints.  
- **Before/After:** Not modified; schema unchanged per "do not change database schema unless absolutely required". product_type and vendor ack column names remain.  
- **Why:** Constraint: no schema change for product_type/vendor ack; only display and market_category migration in 065.  
- **Verification:** No edits to 005 or 048.

**lib/compliance.ts**  
- **Area:** Shared  
- **What it controls:** Product type compliance; isIntoxicatingAllowedNow(); getIntoxicatingCutoffDate(); validation messages.  
- **Before:** User message "Intoxicating products are only allowed until...".  
- **After:** User message "Recreational products are only allowed until..."; function names and env INTOXICATING_ALLOWED_UNTIL unchanged (identifier only).  
- **Why:** User-facing message must say Recreational; identifiers left as-is to avoid broad renames.  
- **Verification:** Grep shows "Recreational products" in message.

**.env.example**  
- **Area:** Backend  
- **What it controls:** Example env var name.  
- **Before/After:** INTOXICATING_ALLOWED_UNTIL unchanged (env key).  
- **Why:** Env key not rendered in UI.  
- **Verification:** No UI impact.

**scripts/verify-vendor-creates.ts**  
- **Area:** Tests/scripts  
- **What it controls:** Script payloads with product_type.  
- **Before/After:** product_type "intoxicating" / "non_intoxicating" (DB value).  
- **Why:** Script tests API with valid schema values.  
- **Verification:** No UI.

---

## D) Remaining Legacy Occurrences (must be empty if complete)

**User-visible copy:** None. No app or components file renders the strings "Intoxicating", "Intoxicated", or "Psychoactive" to the user. All such occurrences are:

- In **comments or docs** (e.g. lib/markets.ts, docs/markets-qa.md, migration comments).
- In **normalization logic** (lib/markets.ts: checking input for intoxicating/psychoactive/intoxicated).
- In **identifiers** (getIntoxicatingCutoffDate, isIntoxicatingAllowedNow, intoxicating_policy_ack, INTOXICATING_ALLOWED_UNTIL).
- In **DB schema / values** (product_type enum value "intoxicating", column names) — not changed per constraints.
- In **tests** (asserting normalization and guardrail; test descriptions).
- In **migration SQL** (065: migrating FROM INTOXICATING; 048/005: historical schema).

So for **UI-facing** legacy words: **None**.

---

## E) Verification Checklist (actionable steps)

1. **Tests**
   - `npm run test -- --run __tests__/markets.test.ts`  
   - Expect: 12 tests pass (normalization + display names + UI guardrail scan).

2. **Lint**
   - `npm run lint` (if script exists) or project linter.  
   - Resolve any new issues in touched files.

3. **Build**
   - `npm run build`  
   - Expect: successful Next.js build.

4. **Products**
   - Open `/products`.  
   - Confirm Market Switcher shows "CBD & Wellness", "Industrial", "Services", **"Recreational"** (no "Intoxicating").  
   - Select Recreational (if unverified, modal "Recreational Market is 21+").  
   - Confirm verification notice says "recreational market" and "Start Verification" links to /verify.

5. **Discover**
   - Open `/discover`.  
   - Confirm no market filter and no legacy copy.

6. **Feed**
   - Open `/newsfeed` (or feed route).  
   - Confirm no market switcher and no legacy copy.

7. **Vendor create/edit**
   - As vendor, go to create product (or edit product).  
   - Confirm Product type dropdown shows **"Recreational"** (and "Non-Recreational", "Delta-8"), not "Intoxicating".  
   - Confirm error/copy says "Recreational products" when applicable.

8. **Vendor registration**
   - Open vendor registration.  
   - Confirm policy ack copy says "recreational products", not "intoxicating".

9. **Admin**
   - As admin, open compliance (e.g. `/admin/compliance`).  
   - Confirm column header is **"Recreational Ack"**, not "Intoxicating Ack".

10. **Verify flow**
    - Open `/verify` (or `/verify-age`).  
    - Confirm copy says "recreational products" and "recreational market", not "intoxicating".

11. **Guardrail regression**
    - Intentionally add a string "Intoxicating" in a user-facing place in e.g. `app/products/ProductsList.tsx` (then remove).  
    - Run `npm run test -- --run __tests__/markets.test.ts`.  
    - Expect: UI guardrail test fails when the word is present; passes after removal.

---

**Normalization helper path:** `lib/markets.ts` — `normalizeMarket()`, `isRecreationalCategory()`, `getMarketDisplayName()`, `toDbMarket()`, `fromDbMarket()`.

**UI label mapping path:** `lib/markets.ts` — `MARKET_DISPLAY_NAMES`, `getMarketDisplayName()`.

**Tests/guardrails path:** `__tests__/markets.test.ts` — normalization tests + UI scan (no Intoxicating/Intoxicated/Psychoactive in app/components .tsx except allowed identifiers).
