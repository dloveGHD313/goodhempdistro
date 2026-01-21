import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import Footer from "@/components/Footer";
import CategoriesClient from "./CategoriesClient";
import type { Category } from "@/lib/categories.types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Category Management | Good Hemp Distro Admin",
  description: "Manage product categories",
};

export const dynamic = 'force-dynamic';

async function getCategories(): Promise<Category[]> {
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("categories")
      .select("id, name, slug, parent_id, requires_coa, category_type, group")
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return [];
    }

    return (data || []) as Category[];
  } catch (err) {
    console.error("Fatal error fetching categories:", err);
    return [];
  }
}

export default async function AdminCategoriesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin/categories");
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const categories = await getCategories();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Category Management</h1>
          <CategoriesClient initialCategories={categories} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
