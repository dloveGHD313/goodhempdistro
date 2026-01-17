import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

type Vendor = {
  id: string;
  name: string;
  description?: string;
  specialties?: string;
  created_at?: string;
};

type Props = {
  params: Promise<{ id: string }>;
};

async function getVendor(id: string): Promise<Vendor | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name, description, specialties, created_at")
      .eq("id", id)
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
    title: `${vendor.name} | Good Hemp Distro`,
    description: vendor.description || `Learn more about ${vendor.name}`,
  };
}

export default async function VendorDetailPage(props: Props) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  let hasAccess = profile?.role === "vendor" || profile?.role === "admin";

  if (!hasAccess) {
    const { data: activeSubscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("package_type", "consumer")
      .in("status", ["active", "trialing"])
      .maybeSingle();

    hasAccess = !!activeSubscription;
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">Membership Required</h1>
            <p className="text-gray-300 mb-6">
              Upgrade to a consumer plan to view vendor details.
            </p>
            <Link href="/get-started" className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition">
              View Consumer Plans
            </Link>
          </div>
        </div>
      </main>
    );
  }

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
              <h1 className="text-3xl font-bold mb-4">{vendor.name}</h1>
              {vendor.specialties && (
                <div className="flex gap-2 flex-wrap justify-center mb-6">
                  {vendor.specialties.split(",").map((specialty) => (
                    <span
                      key={specialty.trim()}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                    >
                      {specialty.trim()}
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
                {vendor.description || "This vendor specializes in premium hemp products with a commitment to quality and sustainability."}
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
