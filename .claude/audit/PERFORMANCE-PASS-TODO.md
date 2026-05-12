# Phase 7.5 — Performance Pass TODO

**Captured during Phase 3 verification — deferred to AFTER all remaining builds ship.**

CEO direction (2026-05-12): perf pass benefits from being done against the final code surface, not an interim state. Clear the build queue first, then sprint on performance. Target: **LCP < 2.5s mobile** on every public route.

## Phase 3 Lighthouse mobile baseline

| Route | Perf | A11y | BP | SEO | **LCP** | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` (welcome) | 57 | 96 | 96 | 100 | **14.2s** 🚨 | 0.227 | 313 ms |
| `/products` | 55 | 93 | 92 | 100 | **15.0s** 🚨 | 0.227 | 262 ms |
| `/pricing` | 52 | 98 | 96 | 100 | **15.4s** 🚨 | 0.244 | 445 ms |
| `/vendors` | 75 | 95 | 92 | 100 | 3.2s ⚠️ | 0.227 | 331 ms |

Raw JSON dumps preserved at `.claude/audit/lighthouse/{home,products,pricing,vendors}.json`.

## Hypothesized root causes (from rendered HTML inspection during Phase 3)

1. **Welcome page hero image (`/brand/goodhempdistrologo.png`)** is 1536×1024 served at 96×96. Massive over-fetch.
2. **Global mounts in `app/layout.tsx`** all run on every page:
   - `<MarketModeProvider>`, `<MotionProvider>`, `<PageTransition>`, `<PersistWelcomeIntents>`, `<Phase15Gate>`, `<MascotGate>`, `<TravelAdvisory>`, `<AgeGate>`, `<RecoveryHashRedirect>`
   - Several of these are client components that trigger hydration JS.
3. **No image optimization** for vendor-pasted product images (we shipped `unoptimized` in PR ~#169 for cross-domain safety — that's fast for the CDN but skips Next's image optimizer).
4. **CSS bundling** — `b079eaa90e19feec.css` was ~30KB+ preloaded on every page.
5. **Font loading** — both DM_Sans + Playfair_Display + Geist (3 font families) loaded with `display: swap` (good) but on welcome page LCP may be a text element waiting for the serif font.
6. **`force-dynamic` on root layout** prevents Next.js from pre-rendering — every request is a fresh SSR.

## Proposed perf sprint deliverables

### Quick wins (1 PR each, mostly mechanical)

- [ ] **Optimize hero images** — generate properly-sized WebP variants of `goodhempdistrologo.png`; use Next/Image with `priority` flag on hero
- [ ] **Defer non-critical layout mounts** — `<MotionProvider>`, `<PersistWelcomeIntents>`, `<RecoveryHashRedirect>`, `<Phase15Gate>` are not above-the-fold-critical. Lazy-mount via `dynamic(() => import('...'), { ssr: false })`.
- [ ] **Trim unused CSS** — Tailwind purge audit; remove unused brand theme variants from `globals.css`
- [ ] **Preconnect** to Supabase + Stripe origins — `<link rel="preconnect">` in root layout `<head>`
- [ ] **Image dimensions** on every `<img>` — fix the 0.22 CLS by reserving space

### Medium (2-3 PRs)

- [ ] **Conditional client-component loading** — `<AgeGate>` runs on every page even after user accepts. Should self-unmount once verified.
- [ ] **Cache static-ish pages** — `/about`, `/come-back-later`, `/pricing` can use ISR with `revalidate: 3600` instead of `force-dynamic`. (Verify middleware doesn't poison cache.)
- [ ] **Code-split route bundles** — analyze Next bundle with `@next/bundle-analyzer`; identify route-specific bundles bigger than 200KB

### Larger (1-2 PRs)

- [ ] **Audit and reduce 3rd-party scripts** — Vercel analytics, Stripe.js, any tracking pixels. Lazy-load below the fold.
- [ ] **Edge SSR for top routes** — move `/`, `/products`, `/pricing` to Vercel Edge runtime if Supabase server client supports it

## Success criteria

Per CEO direction:
- LCP < 2.5s mobile on `/`, `/products`, `/pricing`, `/vendors`
- CLS < 0.1 on every audited route
- Perf score ≥ 80 mobile on every audited route
- Maintain SEO 100, A11y ≥ 95, Best Practices ≥ 95

## When to run

After:
- Build #3 (Stripe Connect for vendors) — Phase 4
- Build #4 (Ask JAX wrapper) — Phase 5
- Build #5 (Regional Compliance Matrix) — Phase 6
- Builds #6/7/8/9/10 — Phase 7

Then:
- Phase 7.5 = this perf pass
- Phase 8 = FINAL_STATUS.md

Re-run `npx lighthouse` on the same 4 routes after each perf PR. Target file paths:
- `.claude/audit/lighthouse-final/home.json`
- `.claude/audit/lighthouse-final/products.json`
- `.claude/audit/lighthouse-final/pricing.json`
- `.claude/audit/lighthouse-final/vendors.json`
