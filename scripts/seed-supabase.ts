#!/usr/bin/env tsx
/**
 * Supabase Seed Script
 * 
 * Syncs local seed data to production Supabase instance.
 * Run with: npm run seed:supabase
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing required environment variables:");
  if (!supabaseUrl) console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  console.error("\nMake sure these are set in your .env.local file");
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ============================================================================
// SEED DATA DEFINITIONS
// ============================================================================

const navigationLinks = [
  { id: 1, label: "Products", href: "/products", order: 1, visible: true },
  { id: 2, label: "Vendors", href: "/vendors", order: 2, visible: true },
  { id: 3, label: "About", href: "/about", order: 3, visible: true },
  { id: 4, label: "Contact", href: "/contact", order: 4, visible: true },
];

const siteConfig = [
  {
    id: 1,
    key: "site_name",
    value: "Good Hemp Distro",
    type: "string",
    description: "Site name displayed in header",
  },
  {
    id: 2,
    key: "site_tagline",
    value: "Premium Hemp Products Marketplace",
    type: "string",
    description: "Site tagline for hero section",
  },
  {
    id: 3,
    key: "primary_color",
    value: "#16a34a",
    type: "color",
    description: "Primary brand color (green-600)",
  },
  {
    id: 4,
    key: "enable_blog",
    value: "true",
    type: "boolean",
    description: "Enable blog functionality",
  },
];

const designSettings = [
  {
    id: 1,
    setting_key: "theme",
    setting_value: "dark",
    category: "appearance",
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    setting_key: "header_style",
    setting_value: "fixed",
    category: "layout",
    updated_at: new Date().toISOString(),
  },
];

// Helper function to generate a UUID
function generateUUID(): string {
  return crypto.randomUUID();
}

const productSeeds = [
  {
    id: generateUUID(),
    name: "Premium CBD Oil",
    category: "oils",
    price_cents: 4999,
    featured: true,
  },
  {
    id: generateUUID(),
    name: "Hemp Flower - Indoor",
    category: "flower",
    price_cents: 2999,
    featured: true,
  },
  {
    id: generateUUID(),
    name: "CBD Gummies",
    category: "edibles",
    price_cents: 3499,
    featured: false,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).select("*").limit(1);
    // If no error or error is about empty result, table exists
    return !error || error.code === "PGRST116";
  } catch {
    return false;
  }
}

/**
 * Get valid column names for a table from information_schema.columns
 */
async function getTableColumns(tableName: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName);

    if (error || !data) {
      console.warn(`   ⚠️  Could not fetch columns for ${tableName}, proceeding without validation`);
      return [];
    }

    return data.map((row: Record<string, unknown>) => String(row.column_name)).sort();
  } catch (err) {
    console.warn(`   ⚠️  Error querying columns for ${tableName}:`, err);
    return [];
  }
}

/**
 * Strip keys from objects that don't exist in the table schema
 */
function stripInvalidKeys<T extends Record<string, any>>(
  data: T[],
  validColumns: string[],
  tableName: string
): T[] {
  if (validColumns.length === 0) {
    return data;
  }

  const stripped = data.map((row) => {
    const validRow: Record<string, any> = {};
    const strippedKeys: string[] = [];

    for (const [key, value] of Object.entries(row)) {
      if (validColumns.includes(key)) {
        validRow[key] = value;
      } else {
        strippedKeys.push(key);
      }
    }

    if (strippedKeys.length > 0) {
      console.log(`   📋 Stripped columns from ${tableName}: ${strippedKeys.join(", ")}`);
    }

    return validRow as T;
  });

  return stripped;
}

async function upsertData<T extends Record<string, any>>(
  tableName: string,
  data: T[],
  onConflict?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Check if table exists first
    const exists = await tableExists(tableName);
    if (!exists) {
      return {
        success: false,
        count: 0,
        error: `Table '${tableName}' does not exist (skipping)`,
      };
    }

    // Get valid columns for this table (only for products table)
    let dataToUpsert = data;
    if (tableName === "products") {
      const validColumns = await getTableColumns(tableName);
      if (validColumns.length > 0) {
        dataToUpsert = stripInvalidKeys(data, validColumns, tableName);
      }
    }

    // Upsert data
    const { data: result, error } = await supabase
      .from(tableName)
      .upsert(dataToUpsert, { onConflict: onConflict || "id" })
      .select();

    if (error) {
      return {
        success: false,
        count: 0,
        error: error.message,
      };
    }

    return {
      success: true,
      count: result?.length || dataToUpsert.length,
    };
  } catch (err) {
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedSupabase() {
  console.log("🌱 Starting Supabase seed process...\n");
  console.log(`📍 Target: ${supabaseUrl}\n`);

  const results: Array<{
    table: string;
    success: boolean;
    count: number;
    error?: string;
  }> = [];

  // 1. Seed navigation links
  console.log("📌 Seeding navigation links...");
  const navResult = await upsertData("navigation", navigationLinks);
  results.push({ table: "navigation", ...navResult });
  
  if (navResult.success) {
    console.log(`   ✅ Upserted ${navResult.count} navigation links`);
  } else {
    console.log(`   ⚠️  ${navResult.error}`);
  }

  // 2. Seed site config
  console.log("⚙️  Seeding site configuration...");
  const configResult = await upsertData("site_config", siteConfig);
  results.push({ table: "site_config", ...configResult });
  
  if (configResult.success) {
    console.log(`   ✅ Upserted ${configResult.count} config entries`);
  } else {
    console.log(`   ⚠️  ${configResult.error}`);
  }

  // 3. Seed design settings
  console.log("🎨 Seeding design settings...");
  const designResult = await upsertData("design_settings", designSettings);
  results.push({ table: "design_settings", ...designResult });
  
  if (designResult.success) {
    console.log(`   ✅ Upserted ${designResult.count} design settings`);
  } else {
    console.log(`   ⚠️  ${designResult.error}`);
  }

  // 4. Seed products (optional)
  console.log("📦 Seeding product data...");
  const productsResult = await upsertData("products", productSeeds);
  results.push({ table: "products", ...productsResult });
  
  if (productsResult.success) {
    console.log(`   ✅ Upserted ${productsResult.count} products`);
  } else {
    console.log(`   ⚠️  ${productsResult.error}`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SEED SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const skipped = results.filter((r) => !r.success && r.error?.includes("does not exist"));

  console.log(`\n✅ Successful: ${successful.length}`);
  successful.forEach((r) => {
    console.log(`   - ${r.table}: ${r.count} records`);
  });

  if (skipped.length > 0) {
    console.log(`\n⚠️  Skipped (table not found): ${skipped.length}`);
    skipped.forEach((r) => {
      console.log(`   - ${r.table}`);
    });
  }

  if (failed.length > 0 && failed.length !== skipped.length) {
    console.log(`\n❌ Failed: ${failed.length - skipped.length}`);
    failed
      .filter((r) => !r.error?.includes("does not exist"))
      .forEach((r) => {
        console.log(`   - ${r.table}: ${r.error}`);
      });
  }

  console.log("\n" + "=".repeat(60));

  // Exit with appropriate code
  if (failed.length > 0 && failed.length !== skipped.length) {
    console.log("\n⚠️  Some operations failed. Review errors above.");
    process.exit(1);
  }

  console.log("\n✅ Seed completed successfully!");
  process.exit(0);
}

// ============================================================================
// RUN
// ============================================================================

seedSupabase().catch((err) => {
  console.error("\n❌ Fatal error during seed:");
  console.error(err);
  process.exit(1);
});
