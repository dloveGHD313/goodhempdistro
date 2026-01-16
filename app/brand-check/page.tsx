import Image from "next/image";
import { brand } from "@/lib/brand";

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
      </div>
    </main>
  );
}
