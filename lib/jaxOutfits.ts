/**
 * JAX outfit registry — one source of truth for which JAX artwork appears on
 * which page, so the mascot stays consistent site-wide (CEO direction: JAX in
 * Good Hemp Distro merch everywhere, with a page-relevant outfit per page).
 *
 * HOW OUTFIT ART SHIPS: drop a transparent PNG at the `src` path below
 * (public/mascot/jax/outfits/<key>.png, ~1024×1536, same character model as
 * /assets/jax/jax-master-base.png but wearing the outfit described). Until the
 * file exists, <JaxFigure> renders the base art with the same caption, so
 * adding outfits is a pure asset drop — no code change.
 *
 * Full art brief: docs/JAX-OUTFITS-SPEC.md
 */

export type JaxOutfit = {
  key: string;
  /** Preferred outfit art (may not exist yet — JaxFigure falls back). */
  src: string;
  /** Always-available fallback. */
  fallbackSrc: string;
  alt: string;
  caption: string;
};

const BASE = "/assets/jax/jax-master-base.png";

export const JAX_OUTFITS: Record<string, JaxOutfit> = {
  welcome: {
    key: "welcome",
    src: "/mascot/jax/outfits/welcome.png",
    fallbackSrc: BASE,
    alt: "JAX, the Good Hemp Distro guide, in a GHD logo tee welcoming you to the platform",
    caption: "JAX — your guide to the hemp industry",
  },
  categories: {
    key: "categories",
    src: "/mascot/jax/outfits/categories.png",
    fallbackSrc: BASE,
    alt: "JAX in a Good Hemp Distro apron with a clipboard, presenting the category directory",
    caption: "JAX — showing you around the catalog",
  },
  builder: {
    key: "builder",
    src: "/mascot/jax/outfits/builder.png",
    fallbackSrc: BASE,
    alt: "JAX in a hard hat and GHD safety vest for the hemp building section",
    caption: "JAX — on the job site",
  },
  community: {
    key: "community",
    src: "/mascot/jax/outfits/community.png",
    fallbackSrc: BASE,
    alt: "JAX in a GHD hoodie, hosting the community feed",
    caption: "JAX — holding it down in the community",
  },
  vendor: {
    key: "vendor",
    src: "/mascot/jax/outfits/vendor.png",
    fallbackSrc: BASE,
    alt: "JAX in a GHD polo with a vendor badge, helping vendors get set up",
    caption: "JAX — your vendor success partner",
  },
  learning: {
    key: "learning",
    src: "/mascot/jax/outfits/learning.png",
    fallbackSrc: BASE,
    alt: "JAX in a GHD varsity jacket with a notebook, teaching Learning with JAX",
    caption: "JAX — class is in session",
  },
};

export function getJaxOutfit(key: keyof typeof JAX_OUTFITS | string): JaxOutfit {
  return JAX_OUTFITS[key] ?? JAX_OUTFITS.welcome;
}
