# Mascot asset surfaces

JAX uses a **single master** and **one generator pipeline** under `/public/assets/jax/`.

## Master (do not delete)

- `public/assets/jax/jax-master-base.png` — sole source for all JAX derivatives.

## Generated outputs (in `public/assets/jax/`)

| File | Dimensions | Use |
|------|------------|-----|
| `jax-hero.png` / `jax-hero.webp` | 1800×1800, contain | Welcome hero, onboarding watermark, social |
| `jax-floating.png` / `jax-floating.webp` | 512×512, contain | Floating Ask JAX avatar, onboarding icon |
| `jax-hero@2x.webp` | 2400×2400, contain | Optional high-DPI hero |

## Runtime references

| Surface | Asset path | Component |
|--------|------------|-----------|
| Welcome hero | `/assets/jax/jax-hero.webp` | `components/mascot/JaxWelcomeHero.tsx` |
| Floating Ask JAX avatar | `/assets/jax/jax-floating.webp` | `jaxSpec.ts` avatarSources; `config.ts` JAX idleSrc/fallbackSrc |
| Onboarding icon | `/assets/jax/jax-floating.webp` | `components/onboarding/JaxOnboardingGuide.tsx` |
| Onboarding watermark | `/assets/jax/jax-hero.webp` | `components/onboarding/JaxOnboardingGuide.tsx` |

## Regenerating assets

```bash
npm run generate:jax
```

Requires `jax-master-base.png` in `public/assets/jax/`. Fails loudly if master is missing. Writes all derivatives into `public/assets/jax/`. Requires `sharp` (devDependency).

## Validation

```bash
npm run check:jax
```

Verifies master and all output files exist and file sizes are within limits.

## Legacy

Old per-surface assets (`mascot-hero.png`, `mascot-avatar.png`, etc.) previously under `/public/brand/` have been moved to `public/assets/jax/_archive/` and are no longer referenced. The legacy generator `npm run generate:mascot-assets` (writes to `public/brand/`) remains for backward compatibility but is not used by JAX surfaces.
