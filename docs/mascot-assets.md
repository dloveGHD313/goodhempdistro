# GHD Mascot Assets

## JAX / Ask Jack AI (per-surface assets)
- See **docs/MASCOT_ASSET_SURFACES.md** for the mapping of each surface to its asset path.
- Assets: `mascot-hero.png`, `mascot-avatar.png`, `mascot-icon.png`, `mascot-watermark.png`, `mascot-social.png` (all under `/public/brand/`).
- Legacy: `mascot.png` is kept for backward compatibility but is not used by the app surfaces.

## Other mascots (LEDGER, MILES, ATLAS)
These paths are wired for non-JAX mascots; JAX uses `/brand/mascot.png` only.

- `/public/mascot/ledger/idle.png`
- `/public/mascot/miles/idle.png`
- `/public/mascot/atlas/idle.png`

If a non-JAX mascot file is missing, the UI falls back to `/public/brand/goodhempdistrologo.png`.

## Notes
- Use the provided mascot style reference (cartoon, playful, confident, modern GHD vibe).
- Keep file names and folder structure identical to avoid breaking the build.
