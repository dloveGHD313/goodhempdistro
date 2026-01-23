import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: rootItems, error: rootError } = await supabase.storage
    .from("coas")
    .list("");

  if (rootError) {
    console.error("COA bucket access failed:", rootError.message);
    process.exit(1);
  }

  const { error: prefixError } = await supabase.storage
    .from("coas")
    .list("coas", { limit: 1 });

  if (prefixError) {
    console.error("COA prefix access failed:", prefixError.message);
    process.exit(1);
  }

  console.log("COA bucket is accessible via anon key.");
  console.log("Root items:", rootItems?.length ?? 0);
}

main().catch((error) => {
  console.error("COA verify script failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
