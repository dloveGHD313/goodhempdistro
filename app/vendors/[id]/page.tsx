import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";

type Vendor = {
  id: string;
  business_name: string;
  description?: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
  created_at?: string;
};

type Props = {
  params: Promise<{ id: string }>;
};

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

async function getVendor(id: string): Promise<Vendor | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vendors")
      .select("id, business_name, description, categories, tags, created_at")
      .eq("id", id)
      .eq("is_active", true)
      .eq("is_approved", true)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error fetching vendor:", err);
    return null;
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const vendor = await getVendor(params.id);

  if (!vendor) {
    return {
      title: "Vendor Not Found | Good Hemp Distro",
    };
  }

  return {
    title: `${vendor.business_name} | Good Hemp Distro`,
    description: vendor.description || `Learn more about ${vendor.business_name}`,
  };
}

export default async function VendorDetailPage(props: Props) {
  const params = await props.params;
  const vendor = await getVendor(params.id);

  if (!vendor) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <Link href="/vendors" className="text-green-400 hover:text-green-300 transition mb-8 inline-block">
          ← Back to Vendors
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mt-8">
          {/* Vendor Profile */}
          <div className="md:col-span-1">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
              <div className="text-8xl mb-6">🌿</div>
              <h1 className="text-3xl font-bold mb-4">{vendor.business_name}</h1>
              {(vendor.categories?.length || vendor.tags?.length) && (
                <div className="flex gap-2 flex-wrap justify-center mb-6">
                  {[...(vendor.categories || []), ...(vendor.tags || [])].map((tag) => (
                    <span
                      key={tag}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition">
                Contact Vendor
              </button>
            </div>
          </div>

          {/* Vendor Details */}
          <div className="md:col-span-2 space-y-8">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
              <h2 className="text-2xl font-bold mb-4">About</h2>
              <p className="text-gray-300 leading-relaxed">
                {vendor.description ||
                  "This vendor specializes in premium hemp products with a commitment to quality and sustainability."}
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
              <h2 className="text-2xl font-bold mb-4">Why Choose This Vendor?</h2>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 text-lg">✓</span>
                  <span>Rigorous quality control standards</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 text-lg">✓</span>
                  <span>Third-party laboratory testing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 text-lg">✓</span>
                  <span>Sustainable and ethical practices</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 text-lg">✓</span>
                  <span>Fast and discreet shipping</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 text-lg">✓</span>
                  <span>Excellent customer service</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
              <h2 className="text-2xl font-bold mb-4">Products</h2>
              <p className="text-gray-400 mb-6">
                Browse all products from this vendor.
              </p>
              <Link
                href="/products"
                className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition"
              >
                View Products
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
