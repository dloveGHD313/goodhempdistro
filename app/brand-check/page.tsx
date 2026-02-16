import Image from "next/image";
import { brand } from "@/lib/brand";
import MascotAssetCard from "./MascotAssetCard";

const MASCOT_ASSETS = [
  "mascot.png",
  "mascot-hero.png",
  "mascot-avatar.png",
  "mascot-icon.png",
  "mascot-watermark.png",
  "mascot-social.png",
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
          <img src="/brand/goodhempdistrologo.png" alt="Good Hemp Distros Logo" className="max-w-xs" />
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
          <h2 className="text-xl font-semibold">Mascot assets (QA)</h2>
          <p className="text-sm text-gray-400">
            All 6 mascot files from /public/brand. Rendered size fixed; natural size from image on load.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {MASCOT_ASSETS.map((filename) => (
              <MascotAssetCard key={filename} filename={filename} src={`/brand/${filename}`} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
