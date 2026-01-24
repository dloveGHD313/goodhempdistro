import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: bucket, error: bucketError } = await supabase.storage.getBucket("coas");

  if (bucketError || !bucket) {
    console.error("COA bucket lookup failed:", bucketError?.message || "Not found");
    process.exit(1);
  }

  const { data: rootItems, error: rootError } = await supabase.storage
    .from("coas")
    .list("", { limit: 1 });

  if (rootError) {
    console.warn("COA bucket list blocked (expected if public policy is restricted):", rootError.message);
  } else {
    console.log("COA bucket list succeeded (policy may be too permissive).");
    console.log("Root items:", rootItems?.length ?? 0);
  }

  console.log("COA bucket exists:", bucket.name);
}

main().catch((error) => {
  console.error("COA verify script failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
