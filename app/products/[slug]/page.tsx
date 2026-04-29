import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import AddToCartStub from "./AddToCartStub";

type Props = { params: Promise<{ slug: string }> };

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  image_url: string | null;
  lab_results_url: string | null;
};

async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("id, slug, name, description, price_cents, image_url, lab_results_url")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Product | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product Not Found | Good Hemp Distro" };
  }

  return {
    title: `${product.name} | Good Hemp Distro`,
    description: product.description ?? `Shop ${product.name} on Good Hemp Distro.`,
  };
}

export default async function ProductSlugPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  return (
    <main className="section-shell text-white">
      <nav className="mb-6 text-sm text-zinc-300" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <Link href="/">Home</Link> &gt; <Link href="/products">Shop</Link> &gt; <span>{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <Image
            src={product.image_url || "/placeholder-product.svg"}
            alt={product.name}
            width={900}
            height={900}
            className="w-full h-auto rounded"
          />
        </div>

        <div>
          <h1 className="text-4xl mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>{product.name}</h1>
          <p className="text-2xl mb-4" style={{ color: "#3CB97A", fontFamily: "'DM Sans', sans-serif" }}>
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((product.price_cents ?? 0) / 100)}
          </p>
          <p className="text-zinc-200 mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {product.description || "No description available yet."}
          </p>

          {product.lab_results_url ? (
            <a className="underline text-green-300 mb-6 inline-block" href={product.lab_results_url} target="_blank" rel="noreferrer">
              View Lab Results (PDF)
            </a>
          ) : null}

          <div>
            <AddToCartStub productId={product.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
