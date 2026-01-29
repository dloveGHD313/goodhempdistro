import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Metadata } from "next";
import { getPostBadgeLabel, type PostAuthorRole, type PostAuthorTier } from "@/lib/postPriority";
import ProfileBasicsClient from "./ProfileBasicsClient";

export const metadata: Metadata = {
  title: "Account | Good Hemp Distro",
  description: "Manage your Good Hemp Distro account",
};

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  const user = data.user;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, vendor_plan_id, subscription_status, tier")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const { data: consumer } = await supabase
    .from("consumer_subscriptions")
    .select("subscription_status, consumer_plan_key")
    .eq("user_id", user.id)
    .maybeSingle();

  let authorRole: PostAuthorRole = "consumer";
  if (profile?.role === "admin") {
    authorRole = "admin";
  } else if (vendor?.id) {
    authorRole = "vendor";
  }

  let authorTier: PostAuthorTier = "none";
  if (authorRole === "vendor" && vendor?.subscription_status && ["active", "trialing"].includes(vendor.subscription_status)) {
    if (vendor?.tier === "top") authorTier = "enterprise";
    else if (vendor?.tier === "mid") authorTier = "pro";
    else if (vendor?.tier === "starter") authorTier = "starter";
  }
  if (authorRole === "consumer" && consumer?.subscription_status && ["active", "trialing"].includes(consumer.subscription_status)) {
    authorTier = (consumer?.consumer_plan_key || "").includes("vip") ? "vip" : "starter";
  }

  const badgeLabel = getPostBadgeLabel(authorRole, authorTier, authorRole === "admin");

  const { data: posts } = await supabase
    .from("posts")
    .select("id, content, created_at")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

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
            <div>
              <p className="text-sm text-gray-400">Role</p>
              <p className="capitalize">{authorRole}</p>
            </div>
            {badgeLabel && (
              <div>
                <p className="text-sm text-gray-400">Badge</p>
                <p>{badgeLabel}</p>
              </div>
            )}
          </div>
        </section>

        <ProfileBasicsClient userId={user.id} />

        <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Recent Posts</h2>
          {posts && posts.length > 0 ? (
            <div className="space-y-4 text-gray-300">
              {posts.map((post) => (
                <div key={post.id} className="border-b border-gray-700 pb-3">
                  <p className="text-sm">{post.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(post.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No posts yet.</p>
          )}
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
            <Link
              href="/account/favorites"
              className="border border-gray-600 text-white px-4 py-2 rounded-lg hover:border-green-500 hover:text-green-400 transition"
            >
              Favorites
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
