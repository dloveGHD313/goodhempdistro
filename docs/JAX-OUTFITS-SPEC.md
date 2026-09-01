# JAX Outfit Art Spec

The site now renders JAX through `<JaxFigure outfit="...">` (components/mascot/JaxFigure.tsx),
driven by the registry in `lib/jaxOutfits.ts`. Every page falls back to the master base art
(`public/assets/jax/jax-master-base.png`) until its outfit PNG exists — so shipping an outfit
is a pure asset drop, no code change.

## Character model (never changes)

Match `public/assets/jax/jax-master-base.png` exactly: same face, skin tone, black cap with
green underbrim, yellow-framed glasses, gold chain, gold watch and bracelet, gold stud
earring, trimmed beard, warm confident smile. Same illustration style (bold outlines, rich
shading), same ~3/4 pose family, transparent background, ~1024×1536 PNG.

## Brand requirement (every outfit)

**Good Hemp Distro merch on every outfit** — at minimum the GHD logo
(`public/brand/goodhempdistrologo.png`) printed on the chest of whatever JAX wears (tee,
hoodie, polo, vest, apron, jacket). Logo colors as-is; scale it like a real screen print.

## The six outfits to produce

Drop each finished PNG at the exact path below.

| File (public/mascot/jax/outfits/) | Page | Outfit |
|---|---|---|
| `welcome.png` | /welcome hero | GHD logo tee (base look, but WITH the logo print), welcoming presenting pose |
| `categories.png` | /categories | GHD shop apron over the tee, holding a clipboard or tablet |
| `builder.png` | /projects/estimator + building pages | Hard hat (green), GHD hi-vis safety vest over the tee, work gloves in one hand |
| `community.png` | /community | GHD hoodie, relaxed arms-crossed or wave pose |
| `vendor.png` | vendor dashboard/registration surfaces | GHD polo with a "VENDOR SUCCESS" lanyard badge |
| `learning.png` | Learning with JAX / education | GHD varsity jacket, holding a notebook or marker, teaching gesture |

## Production notes

- Keep the cap, glasses, and gold jewelry in every outfit — they are JAX's identity.
- Transparent background, PNG, ~1024×1536 (2:3). Larger is fine; keep the aspect.
- Name files exactly as listed; the site picks them up on the next deploy with zero code.
- When new pages need new outfits, add an entry to `lib/jaxOutfits.ts` first, then produce
  the art to the same spec.

## Status

As of Sep 1, 2026: zero outfit PNGs exist; all pages render the base art with page-specific
captions. Producing these six images (commissioned artist or an image-generation tool using
jax-master-base.png as the character reference) is the remaining step.
