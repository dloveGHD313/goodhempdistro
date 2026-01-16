import Link from "next/link";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Vendors | Good Hemp Distro",
  description: "Meet our trusted hemp product vendors",
};

type Vendor = {
  id: string;
  name: string;
  description?: string;
  specialties?: string;
};

async function getVendors(): Promise<Vendor[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      redirect("/login");
    }
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name, description, specialties")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching vendors:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Fatal error fetching vendors:", err);
    return [];
  }
}

function VendorSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 animate-pulse">
      <div className="w-24 h-24 bg-gray-700 rounded-full mb-4" />
      <div className="h-6 bg-gray-700 rounded mb-2" />
      <div className="h-4 bg-gray-700 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-6 bg-gray-700 rounded w-20" />
        <div className="h-6 bg-gray-700 rounded w-20" />
      </div>
    </div>
  );
}

export default async function VendorsPage() {
  const vendors = await getVendors();

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Our Vendors</h1>
        <p className="text-xl text-gray-300 mb-12">
          We partner with trusted vendors to bring you the highest quality hemp products.
        </p>

        {vendors.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-4">No vendors available at the moment.</p>
            <p className="text-gray-500">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {vendors.map((vendor) => (
              <Link
                key={vendor.id}
                href={`/vendors/${vendor.id}`}
                className="group"
              >
                <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 hover:border-green-600 transition h-full cursor-pointer">
                  <div className="w-24 h-24 bg-gray-700 rounded-full mb-4 group-hover:bg-gray-600 transition mx-auto flex items-center justify-center text-4xl">
                    🌿
                  </div>
                  <h3 className="text-2xl font-semibold mb-2 text-center group-hover:text-green-400 transition">{vendor.name}</h3>
                  <p className="text-gray-400 mb-4 text-center text-sm">
                    {vendor.description || "Premium hemp products"}
                  </p>
                  {vendor.specialties && (
                    <div className="flex gap-2 flex-wrap justify-center">
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
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">Become a Vendor</h2>
          <p className="text-gray-300 mb-6">
            Interested in partnering with Good Hemp Distro? We're always looking for 
            high-quality vendors who share our commitment to excellence.
          </p>
          <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition">
            Apply Now
          </button>
        </div>
      </div>
    </main>
  );
}
