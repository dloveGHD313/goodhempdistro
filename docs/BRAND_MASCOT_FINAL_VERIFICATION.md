# Brand mascot final — verification report

**Branch:** `chore/brand-mascot-final`  
**Tip commit:** `414acae` (brand: add final mascot asset)  
**Date:** 2026-02-15

---

## STEP 1 — Repo discovery (executed)

### Git state
- **`git status -sb`:** `## chore/brand-mascot-final` (clean, no unstaged/uncommitted changes)
- **`git log --oneline -5`:**
  - 414acae brand: add final mascot asset
  - 34526a0 brand: unify JAX mascot and Ask Jack AI to single mascot asset
  - 811ade3 docs: add Phase4C/5A locate-and-restore report
  - ab53936 phase5a dispatch offers + driver presence + phase4c payout confirmation (#91)
  - dc56c3d Fix driver dashboard proof visibility and onboarding update parity (#90)

### Files changed vs origin/main
**`git diff origin/main...HEAD --name-only`:**
- components/mascot/JaxWelcomeHero.tsx
- components/mascot/config.ts
- components/mascot/spec/jaxSpec.ts
- components/onboarding/JaxOnboardingGuide.tsx
- docs/PHASE4C_5A_LOCATE_AND_RESTORE_REPORT.md
- docs/mascot-assets.md
- public/brand/mascot.png

### Grep: mascot / ask-jack paths
**`rg -n "/brand/mascot\.png|/mascot/jax/|ask-jack-logo\.png"` (repo-wide):**
- **/brand/mascot.png:** Found only in:
  - docs/mascot-assets.md (lines 4, 7)
  - components/mascot/JaxWelcomeHero.tsx (line 30)
  - components/onboarding/JaxOnboardingGuide.tsx (lines 58, 78)
  - components/mascot/spec/jaxSpec.ts (lines 16, 69)
  - components/mascot/config.ts (lines 55, 56)
- **/mascot/jax/:** No matches
- **ask-jack-logo.png:** No matches

Conclusion: All JAX/Ask Jack references use `/brand/mascot.png` only; no legacy `/mascot/jax/` or ask-jack-logo.

### public/brand/mascot.png
- **Exists:** yes
- **Size:** 227,238 bytes (~222 KB)
- **Dimensions:** 1024×1536 px (real image, not 1×1 placeholder)

### Runtime surfaces (where mascot appears)
| Surface | Component / source | Route / context |
|--------|---------------------|-----------------|
| Welcome hero | JaxWelcomeHero.tsx → `<Image src="/brand/mascot.png" />` | `/welcome` (when `NEXT_PUBLIC_MASCOT_ENABLED=true`) |
| Onboarding watermark + icon | JaxOnboardingGuide.tsx → two `<img src="/brand/mascot.png" />` | `/onboarding`, `/onboarding/consumer`, `/onboarding/vendor` (via OnboardingShell) |
| Ask Jack floating widget avatar | MascotWidget → getJaxAvatarSources() → jaxSpec.personas[*].avatarSources `["/brand/mascot.png"]` | Global (layout.tsx → MascotGate → MascotWidget) on all pages when mascot enabled |
| Config fallback | config.ts JAX idleSrc/fallbackSrc | Used by any consumer of mascotAssets.JAX (e.g. MascotAvatar, MascotPanel if they resolve asset) |

**Imports/usages traced:**
- `app/welcome/page.tsx` → WelcomeClient → JaxWelcomeHero
- `app/onboarding/page.tsx` → OnboardingShell → JaxOnboardingGuide
- `app/layout.tsx` → MascotGate → JaxFloatingScaffold → MascotWidget (widget uses jaxSpec avatarSources)
- MascotWidget (components/mascot/MascotWidget.tsx) uses config.ts mascotAssets and jaxSpec getJaxAvatarSources
- MascotPanel, MascotAvatar use mascotAssets from config (JAX uses /brand/mascot.png)

---

## STEP 2 — Visual verification checklist

Use these after pushing and opening a Vercel preview (or local `npm run dev`):

1. **Homepage / welcome — JaxWelcomeHero**
   - **URL:** `https://<preview-origin>/welcome` (or `http://localhost:3000/welcome`)
   - **Condition:** `NEXT_PUBLIC_MASCOT_ENABLED=true` (and optionally server mascot flag)
   - **Check:** Hero section shows single mascot image (1024×1536 asset, scaled); alt "Good Hemp Distro mascot".

2. **Onboarding — JaxOnboardingGuide**
   - **URLs:** `https://<preview>/onboarding`, `https://<preview>/onboarding/consumer`, `https://<preview>/onboarding/vendor`
   - **Condition:** Authenticated user, onboarding flow.
   - **Check:** (1) Faint watermark behind content uses mascot image; (2) Small icon in the guidance bubble (top-left or top-right) uses same mascot image.

3. **Ask Jack / mascot widget (jaxSpec avatar)**
   - **URL:** Any page where layout shows the floating mascot (e.g. `/home`, `/discover`, `/products`, vendor/dashboard).
   - **Condition:** Mascot enabled (client + server flags).
   - **Check:** Floating “Ask JAX” widget avatar uses the same mascot image (sourced from jaxSpec avatarSources → `/brand/mascot.png`).

4. **Brand / docs**
   - **URL:** `https://<preview>/brand-check` — This page shows **logo** only (`/brand/goodhempdistrologo.png`), not the mascot. No change required for mascot QA.
   - **Docs:** `docs/mascot-assets.md` documents JAX/Ask Jack as single asset at `/public/brand/mascot.png` (no runtime URL).

---

## STEP 3 — Build and test

- **`npm run test`:** 41 test files passed, 1 skipped (199 tests passed, 1 skipped). **Result: PASS.**
- **`npm run build`:** Completed successfully. Not blocked by env vars. (Build used `.env.local`; no missing-env errors in output.)

---

## STEP 4 — Commit hygiene

- **Branch:** `chore/brand-mascot-final`
- **Latest commit:** `414acae` — message: `brand: add final mascot asset`
- **Files in 414acae:** Only `public/brand/mascot.png` (binary 70 → 227,238 bytes). No unrelated files.
- **Scope:** All changes on branch vs main are mascot-related (code paths to `/brand/mascot.png`, doc updates, Phase4C/5A restore report, and final mascot asset). No business-logic or unrelated edits.

**Verdict:** Commit and branch are clean; ready for push after your approval.

---

## STOP POINT

Push has **not** been performed. Awaiting your explicit **“PUSH NOW”** approval.

---

## When you say “PUSH NOW”

1. Run:  
   `git push -u origin chore/brand-mascot-final`
2. Open a PR: **base `main`** ← **head `chore/brand-mascot-final`**
   - **Title:** `brand: replace mascot asset`
   - **Body:** (use the PR body below)

### PR body (copy-paste)

**What changed**
- Replaced the placeholder mascot asset with the final Good Hemp Distro mascot PNG.
- All JAX and Ask Jack AI surfaces now use a single asset: `/brand/mascot.png` (welcome hero, onboarding guide, floating widget avatar). Legacy paths (`/mascot/jax/`, ask-jack-logo) have been removed in earlier commits on this branch.

**Files list**
- `components/mascot/JaxWelcomeHero.tsx` — `src="/brand/mascot.png"`, alt text set
- `components/mascot/config.ts` — JAX idleSrc/fallbackSrc → `/brand/mascot.png`
- `components/mascot/spec/jaxSpec.ts` — JAX_CONSUMER and JAX_VENDOR avatarSources → `["/brand/mascot.png"]`
- `components/onboarding/JaxOnboardingGuide.tsx` — watermark and icon → `/brand/mascot.png`
- `docs/mascot-assets.md` — JAX/Ask Jack documented as single asset
- `docs/PHASE4C_5A_LOCATE_AND_RESTORE_REPORT.md` — (existing Phase4C/5A report)
- `public/brand/mascot.png` — final mascot image (1024×1536, ~222 KB)

**Test results**
- `npm run test`: 41 passed, 1 skipped (199 tests passed, 1 skipped).
- `npm run build`: succeeded.

**Manual visual QA checklist**
- [ ] `/welcome` — hero shows mascot image when mascot enabled
- [ ] `/onboarding` (and consumer/vendor) — watermark and guidance icon show mascot
- [ ] Floating Ask Jack widget — avatar shows mascot on any page where widget is visible
- [ ] No 404s for `/brand/mascot.png` in network tab

---

*End of verification report.*
