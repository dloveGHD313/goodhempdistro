import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { Category, CategoryGroup } from "@/lib/categories.types";

/**
 * Admin-only category management API
 * GET: List all categories
 * POST: Create a new category
 */

async function checkAdminAccess() {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  // Check if user has admin role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return { authorized: false, error: "Forbidden - Admin access required", status: 403 };
  }

  return { authorized: true, user };
}

export async function GET(req: NextRequest) {
  try {
    const check = await checkAdminAccess();
    if (!check.authorized) {
      return NextResponse.json(
        { error: check.error },
        { status: check.status || 403 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("categories")
      .select("id, name, slug, parent_id, requires_coa, category_type, group")
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    return NextResponse.json({ categories: data || [] });
  } catch (error) {
    console.error("Category GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const check = await checkAdminAccess();
    if (!check.authorized) {
      return NextResponse.json(
        { error: check.error },
        { status: check.status || 403 }
      );
    }

    const { name, group, parent_id, requires_coa, category_type, slug } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    if (!group || !["industrial", "recreational", "convenience", "food"].includes(group)) {
      return NextResponse.json(
        { error: "Valid group is required (industrial, recreational, convenience, or food)" },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    const categorySlug = slug || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("categories")
      .insert({
        name: name.trim(),
        slug: categorySlug,
        parent_id: parent_id || null,
        requires_coa: requires_coa === true,
        category_type: category_type || 'product',
        group: group as CategoryGroup,
      })
      .select("id, name, slug, parent_id, requires_coa, category_type, group")
      .single();

    if (error) {
      console.error("Error creating category:", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ category: data }, { status: 201 });
  } catch (error) {
    console.error("Category POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
