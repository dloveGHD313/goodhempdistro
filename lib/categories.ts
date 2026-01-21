/**
 * Category helpers - Server and client safe functions to fetch categories
 */

import { createSupabaseServerClient } from "./supabase";
import { createSupabaseBrowserClient } from "./supabase";
import type { Category } from "./categories.types";

export type { Category } from "./categories.types";

/**
 * Fetch all categories (server-side)
 * Use in server components and API routes
 */
/**
 * Fetch all categories (server-side)
 * Returns hierarchical structure with parent and child categories
 */
export async function getCategories(): Promise<Category[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, requires_coa, category_type, group")
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

/**
 * Fetch all categories (client-side)
 * Returns hierarchical structure with parent and child categories
 */
export async function getCategoriesClient(): Promise<Category[]> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, requires_coa, category_type, group")
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

/**
 * Organize categories into hierarchical structure
 * Returns parent categories with nested children
 */
export function organizeCategoriesHierarchically(categories: Category[]): Array<Category & { children?: Category[] }> {
  const parentCategories = categories.filter(cat => !cat.parent_id);
  const childCategories = categories.filter(cat => cat.parent_id);

  return parentCategories.map(parent => ({
    ...parent,
    children: childCategories.filter(child => child.parent_id === parent.id),
  }));
}
