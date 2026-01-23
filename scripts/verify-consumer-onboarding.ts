import { getSupabaseAdminClientOrThrow } from "../lib/supabaseAdmin";

const REQUIRED_COLUMNS = [
  "consumer_type",
  "business_type",
  "purchase_intent",
  "interests",
  "state",
  "city",
  "company_size",
  "experience_level",
  "consumer_onboarding_step",
  "consumer_onboarding_completed",
  "consumer_onboarding_completed_at",
];

async function run() {
  let supabase;
  try {
    supabase = getSupabaseAdminClientOrThrow();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Missing admin env vars";
    console.log(`[verify-consumer-onboarding] Skipping: ${message}`);
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .select(REQUIRED_COLUMNS.join(","))
    .limit(1);

  if (error) {
    console.error("[verify-consumer-onboarding] Failed:", error.message);
    process.exit(1);
  }

  console.log("[verify-consumer-onboarding] OK: required fields available.");
}

run().catch((error) => {
  console.error("[verify-consumer-onboarding] Unexpected error:", error);
  process.exit(1);
});
