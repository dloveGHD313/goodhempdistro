import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account | Good Hemp Distro",
  description: "Manage your Good Hemp Distro account",
};

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  const user = data.user;

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Signed in as</p>
            <h1 className="text-3xl font-bold">{user.email}</h1>
          </div>
          <Link
            href="/dashboard"
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg transition"
          >
            Go to Dashboard
          </Link>
        </div>

        <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Account Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
            <div>
              <p className="text-sm text-gray-400">User ID</p>
              <p className="font-mono text-sm break-all">{user.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Email</p>
              <p>{user.email}</p>
            </div>
          </div>
        </section>

        <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="border border-gray-600 text-white px-4 py-2 rounded-lg hover:border-green-500 hover:text-green-400 transition"
            >
              Browse Products
            </Link>
            <Link
              href="/vendors"
              className="border border-gray-600 text-white px-4 py-2 rounded-lg hover:border-green-500 hover:text-green-400 transition"
            >
              View Vendors
            </Link>
            <Link
              href="/dashboard"
              className="border border-gray-600 text-white px-4 py-2 rounded-lg hover:border-green-500 hover:text-green-400 transition"
            >
              Dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
