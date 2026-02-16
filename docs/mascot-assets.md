# GHD Mascot Assets

## JAX / Ask Jack AI (per-surface assets)
- See **docs/MASCOT_ASSET_SURFACES.md** for the mapping of each surface to its asset path.
- Assets: `mascot-hero.png`, `mascot-avatar.png`, `mascot-icon.png`, `mascot-watermark.png`, `mascot-social.png` (all under `/public/brand/`).
- Legacy: `mascot.png` is the generator master; app surfaces use the per-surface assets above.

## Other mascots (LEDGER, MILES, ATLAS)
These paths are wired for non-JAX mascots; JAX uses the per-surface assets above.

- `/public/mascot/ledger/idle.png`
- `/public/mascot/miles/idle.png`
- `/public/mascot/atlas/idle.png`

If a non-JAX mascot file is missing, the UI falls back to `/public/brand/goodhempdistrologo.png`.

## Generator (scripts/generate-mascot-assets.mjs)
- Default: `npm run generate:mascot-assets` reads `public/brand/mascot.png`, normalizes it, overwrites master and writes the five derivatives.
- Custom source: `node scripts/generate-mascot-assets.mjs --source path/to/image.png` — reads from that path, writes only the five derivatives (does not overwrite `mascot.png`).
- To overwrite the master from a custom source: add `--write-master`.

## Notes
- Use the provided mascot style reference (cartoon, playful, confident, modern GHD vibe).
- Keep file names and folder structure identical to avoid breaking the build.
