import Image from "next/image";
import { brand } from "@/lib/brand";
import MascotAssetCard from "./MascotAssetCard";

const JAX_ASSETS = [
  { filename: "jax-hero.webp", src: "/assets/jax/jax-hero.webp" },
  { filename: "jax-hero.png", src: "/assets/jax/jax-hero.png" },
  { filename: "jax-floating.webp", src: "/assets/jax/jax-floating.webp" },
  { filename: "jax-floating.png", src: "/assets/jax/jax-floating.png" },
  { filename: "jax-hero@2x.webp", src: "/assets/jax/jax-hero@2x.webp" },
] as const;

export default function BrandCheckPage() {
  return (
    <main className="min-h-screen text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>
            Brand Logo Check
          </h1>
          <p className="text-gray-300">Verifying the logo asset loads from public path.</p>
        </div>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Static img tag</h2>
          <img src="/brand/goodhempdistrologo-sm.png" alt="Good Hemp Distros Logo" className="max-w-xs" />
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Next Image component</h2>
          <Image
            src={brand.logoPath}
            alt={brand.logoAlt}
            width={brand.logoWidth}
            height={brand.logoHeight}
            className="max-w-xs h-auto"
          />
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold">JAX mascot assets (QA)</h2>
          <p className="text-sm text-gray-400">
            Standardized JAX assets from /public/assets/jax. Rendered size fixed; natural size from image on load.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {JAX_ASSETS.map(({ filename, src }) => (
              <MascotAssetCard key={filename} filename={filename} src={src} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
