import Link from "next/link";
import Image from "next/image";
import SectionReveal from "./SectionReveal";

type ProductCard = {
  id: string;
  name: string;
  market_category: string | null;
  price_cents: number;
  vendor_name: string | null;
  image_url: string | null;
};

export default function FeaturedProductsSection({ initialProducts }: { initialProducts: ProductCard[] }) {
  return (
    <section className="px-6 py-20 bg-[#0D1512]">
      <SectionReveal>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A] mb-3">MARKETPLACE</p>
              <h2 className="text-4xl text-[#F0EDE6] mb-3 font-serif">Verified Hemp Products</h2>
              <p className="text-[#8A9E96]">Lab-tested, COA-certified, from approved vendors only.</p>
            </div>
            <Link href="/products" className="text-[#3CB97A] font-semibold hover:underline">
              Browse all products →
            </Link>
          </div>

          {initialProducts.length === 0 ? (
            <div className="col-span-3 text-center py-20 border border-white/10 rounded-2xl bg-[#141F1A]">
              <p className="text-xs uppercase tracking-widest text-[#3CB97A] mb-4">Marketplace</p>
              <h3 className="text-3xl text-[#F0EDE6] mb-4 font-serif">Products arriving soon</h3>
              <p className="text-[#8A9E96] max-w-md mx-auto mb-8">
                Verified hemp vendors are listing their products now. Be the first to know when new products are available.
              </p>
              <Link href="/vendor-registration" className="px-6 py-3 bg-[#3CB97A] text-[#0D1512] font-semibold rounded-lg text-sm inline-block">
                List Your Products →
              </Link>
            </div>
          ) : (
            <div className="grid grid-flow-col auto-cols-[85%] md:grid-flow-row md:auto-cols-auto md:grid-cols-3 gap-5 overflow-x-auto pb-2">
              {initialProducts.slice(0, 6).map((product) => (
                <article
                  key={product.id}
                  className="rounded-2xl bg-[#141F1A] border border-white/10 p-5 hover:scale-[1.02] hover:shadow-lg hover:border-[rgba(60,185,122,0.25)] transition-all duration-200"
                >
                  <div className="aspect-square rounded-xl bg-[#1A2820] mb-4 flex items-center justify-center text-4xl overflow-hidden relative">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 85vw, 33vw"
                      />
                    ) : (
                      <span>🌿</span>
                    )}
                  </div>
                  <p className="inline-flex px-3 py-1 rounded-full text-xs bg-[rgba(60,185,122,0.10)] text-[#3CB97A] mb-3">
                    {product.market_category || "Hemp"}
                  </p>
                  <h3 className="font-semibold text-[#F0EDE6] mb-1">{product.name}</h3>
                  <p className="text-sm text-[#4A5E57] mb-4">{product.vendor_name || "Verified Vendor"}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-[#3CB97A]">${(product.price_cents / 100).toFixed(2)}</p>
                    <Link href={`/products/${product.id}`} className="text-[#3CB97A] font-medium hover:underline">
                      View →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </SectionReveal>
    </section>
  );
}
