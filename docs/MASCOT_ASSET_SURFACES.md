# Mascot asset surfaces

Each JAX/Ask Jack surface uses a dedicated asset to avoid bad cropping and white borders. All paths are under `/public/brand/` (served as `/brand/`).

| Surface | File path | Expected dimensions / aspect | Used in |
|--------|-----------|------------------------------|--------|
| Welcome hero | `/brand/mascot-hero.png` | ~600px wide max, transparent, tightly cropped | `components/mascot/JaxWelcomeHero.tsx` — hero on `/welcome` |
| Floating Ask JAX avatar | `/brand/mascot-avatar.png` | 384×384 (head/shoulders), transparent | `components/mascot/spec/jaxSpec.ts` (avatarSources); `components/mascot/config.ts` (JAX idleSrc/fallbackSrc); MascotWidget, MascotPanel, MascotAvatar |
| Onboarding small icon | `/brand/mascot-icon.png` | 512×512 square, transparent | `components/onboarding/JaxOnboardingGuide.tsx` — small icon in guidance bubble |
| Onboarding watermark | `/brand/mascot-watermark.png` | ~420px wide max, transparent (opacity via CSS) | `components/onboarding/JaxOnboardingGuide.tsx` — decorative watermark behind card |
| Social thumbnail | `/brand/mascot-social.png` | 1024×1024 square, transparent or clean edges | Reserved for og:image / social sharing |

**Legacy:** `mascot.png` remains in `public/brand/` for backward compatibility but is no longer referenced by the above surfaces.

**Regenerating assets:** From repo root run:
```bash
node scripts/generate-mascot-assets.mjs [source.png]
```
Default source: `public/brand/mascot.png`. Outputs the five files above. Requires `sharp` (devDependency).
