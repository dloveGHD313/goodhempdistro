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
export async function getCategories(): Promise<Category[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, group")
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
 * Use in client components
 */
export async function getCategoriesClient(): Promise<Category[]> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, group")
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
