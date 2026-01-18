/**
 * Seed initial categories via admin API (NOT SQL)
 * Run: npx tsx scripts/seed-categories.ts
 * 
 * Requires:
 * - User must be logged in with admin role
 * - Environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SITE_URL
 * 
 * Usage: Run this script while authenticated as admin
 */

const categories = [
  // Industrial
  { name: "Hemp Fiber", group: "industrial" },
  { name: "Hemp Seed Oil", group: "industrial" },
  { name: "Hempcrete", group: "industrial" },
  { name: "Hemp Textiles", group: "industrial" },
  { name: "Hemp Biofuels", group: "industrial" },
  { name: "Hemp Paper", group: "industrial" },
  
  // Recreational
  { name: "CBD Flower", group: "recreational" },
  { name: "Pre-Rolls", group: "recreational" },
  { name: "Vape Cartridges", group: "recreational" },
  { name: "Concentrates", group: "recreational" },
  { name: "Edibles", group: "recreational" },
  { name: "Topicals", group: "recreational" },
  
  // Convenience
  { name: "CBD Tinctures", group: "convenience" },
  { name: "CBD Capsules", group: "convenience" },
  { name: "CBD Gummies", group: "convenience" },
  { name: "CBD Oils", group: "convenience" },
  { name: "CBD Lotions", group: "convenience" },
  { name: "CBD Balms", group: "convenience" },
  
  // Food
  { name: "Hemp Seeds", group: "food" },
  { name: "Hemp Protein Powder", group: "food" },
  { name: "Hemp Hearts", group: "food" },
  { name: "Hemp Flour", group: "food" },
  { name: "Hemp Snacks", group: "food" },
  { name: "Hemp Beverages", group: "food" },
];

async function seedCategories() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const apiUrl = `${siteUrl}/api/admin/categories`;

  console.log("🌱 Starting category seed...");
  console.log(`📡 API URL: ${apiUrl}`);

  let successCount = 0;
  let errorCount = 0;

  for (const category of categories) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(category),
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ Created: ${category.name} (${category.group})`);
        successCount++;
      } else {
        if (data.error?.includes("already exists")) {
          console.log(`ℹ️  Skipped (exists): ${category.name}`);
        } else {
          console.error(`❌ Failed: ${category.name} - ${data.error || response.statusText}`);
          errorCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error creating ${category.name}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary: ${successCount} created, ${errorCount} errors`);
  console.log("\n⚠️  Note: This script requires admin authentication.");
  console.log("   Ensure you're logged in as an admin user when running.");
}

seedCategories().catch(console.error);
