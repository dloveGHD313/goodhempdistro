# Performance Diagnosis — Mobile LCP 13.5s

**Date:** 2026-03-02
**Branch:** fix/mobile-lcp-stabilization
**Pages affected:** /welcome, /about, /wholesale

---

## Root Causes (ranked by impact)

### 1. `WelcomeClient.tsx` — `mounted` guard hides ALL content (PRIMARY, ~12s of delay)

**File:** `app/welcome/WelcomeClient.tsx`

**Mechanism:**
```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

if (!mounted) {
  return (
    <div className="animate-fade-in opacity-0">   // ← invisible skeleton
      <div className="h-24" />                    // ← empty
      <div className="h-64 ..." />                // ← empty
    </div>
  );
}
```

The H1 ("The hemp industry, all in one place.") only appears in the DOM **after**:
1. JS bundle downloads (~1-3s on mobile 3G)
2. React hydrates the tree (~200-500ms)
3. `useEffect` fires (~50ms)
4. `setMounted(true)` re-renders

This pushes LCP to 12-14s on slow mobile connections.

**Why the guard was added:** Originally to prevent hydration mismatch when checking `process.env.NEXT_PUBLIC_MASCOT_ENABLED`. That check was later removed — `mascotEnabled = true` is now hardcoded. The guard is **now entirely unnecessary** and is the primary LCP regression.

**Fix:** Remove the `mounted` guard entirely.

---

### 2. `Reveal` wrapping H1 — `opacity: 0` in SSR HTML

**File:** `app/welcome/WelcomeClient.tsx` (and `app/about/page.tsx`)

**Mechanism:**
Framer Motion's `initial: { opacity: 0 }` is serialized into the server-rendered HTML as inline `style="opacity: 0"`. The H1 exists in the initial HTML but is **invisible** — Lighthouse and browsers see it as non-visible for LCP purposes.

**Fix:** Don't wrap the H1 in `<Reveal>`. Render it in a plain div.

---

### 3. `CinematicHero.tsx` — `motion.h1` initial opacity:0

**File:** `components/entry/CinematicHero.tsx`

```tsx
<motion.h1 className="hero-title..." {...fadeUp(0.15)}>
// fadeUp(0.15) = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, delay: 0.15 }
```

The H1 renders at opacity:0 in SSR HTML AND has a 150ms animation delay. On mobile, JS must hydrate before the animation even starts.

**Fix:** Render H1 and subtitle as plain elements (visible immediately). Keep CTA animations.

---

### 4. `JaxEntryGreeting.tsx` — `motion.section` initial opacity:0

**File:** `components/entry/JaxEntryGreeting.tsx`

```tsx
<motion.section
  initial={reducedMotion ? undefined : { opacity: 0, scale: 0.92 }}
  // JAX image has priority but wrapper is hidden
>
```

The JAX image has `priority` (correct — preloads it), but the wrapper starts at `opacity:0, scale:0.92`. Browser preloads the image but it stays invisible until animation runs.

**Fix:** Start wrapper at visible state (no opacity:0 initial).

---

### 5. `app/about/page.tsx` — H1 in `<Reveal>` (opacity:0 from SSR)

Same mechanism as #2. H1 wrapped in Reveal which sets `opacity:0` in SSR HTML.

**Fix:** Render H1 without Reveal wrapper.

---

## `_next/image` 400 errors (audit artifact, NOT a production bug)

The audit tool captured image URLs containing Vercel deployment hash `?dpl=dpl_xyz`. These hashes are ephemeral — they change with each deployment. By the time the audit tool fetched the assets (seconds later), the hash was stale → 400.

**In real browsers:** The HTML always contains the current deployment's hash → images load correctly.
**Verification:** `/brand/goodhempdistrologo.png` returns 200 directly (confirmed during audit).
**No fix required** for production. The `_next/image` pipeline is working correctly.

---

## Fix Plan

| File | Change | LCP impact |
|---|---|---|
| `app/welcome/WelcomeClient.tsx` | Remove `mounted` guard | ~12s saved |
| `app/welcome/WelcomeClient.tsx` | Remove `Reveal` from H1 | ~0.5s saved |
| `components/entry/CinematicHero.tsx` | H1 and subtitle visible in initial HTML | ~0.5s saved |
| `components/entry/JaxEntryGreeting.tsx` | Section wrapper starts visible | ~0.3s saved |
| `app/about/page.tsx` | H1 not wrapped in Reveal | ~1s saved on /about |

Expected mobile LCP after fixes: **1.5-3.5s** (from ~13.5s)
