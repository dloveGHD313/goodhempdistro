# GHD Mascot Assets

## JAX — standardized pipeline

- **Master:** `public/assets/jax/jax-master-base.png` (only asset to edit; all others are generated).
- **Generator:** `npm run generate:jax` → `node scripts/generate-jax-assets.mjs`
  - Reads master, writes: `jax-hero.png`, `jax-hero.webp`, `jax-floating.png`, `jax-floating.webp`, `jax-hero@2x.webp` into `public/assets/jax/`.
- **Validation:** `npm run check:jax` — ensures master and outputs exist and sizes are reasonable.
- **Surfaces:** See **docs/MASCOT_ASSET_SURFACES.md** for which file is used where (welcome hero, floating avatar, onboarding).

## Other mascots (LEDGER, MILES, ATLAS)

- `/public/mascot/ledger/idle.png`
- `/public/mascot/miles/idle.png`
- `/public/mascot/atlas/idle.png`

If a non-JAX mascot file is missing, the UI falls back to `/public/brand/goodhempdistrologo.png`.

## Legacy brand pipeline (optional)

- `npm run generate:mascot-assets` reads `public/brand/mascot.png` and writes derivatives to `public/brand/`. JAX no longer uses these; they are superseded by the `public/assets/jax/` pipeline. Old files were moved to `public/assets/jax/_archive/`.

## Notes

- Use the provided mascot style reference (cartoon, playful, confident, modern GHD vibe).
- Do not use raw `<img>` for mascot assets; use Next.js `Image` (enforced by `npm run check:mascot-img`).
