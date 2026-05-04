/**
 * US state codes where intoxicating/gated hemp products are restricted based
 * on widely-reported state law as of late 2025. Used in forms for the static
 * advisory notice. The API routes query hemp_state_rules (DB) as source of
 * truth — this list must mirror the conservative overrides seeded in
 * 20260502020100_seed_hemp_state_rules.sql.
 *
 * HEMP ATTORNEY REVIEW REQUIRED before treating this list as legal advice.
 */
export const RESTRICTED_STATES_FOR_INTOXICATING: readonly string[] = [
  "ID", // Idaho prohibits THC including delta-8/9 (0.0% THC requirement)
  "KS", // Kansas restricts intoxicating hemp
  "SD", // South Dakota restricts intoxicating hemp
  "IA", // Iowa restricts intoxicating hemp
  "MS", // Mississippi restricts recreational intoxicating hemp
  "LA", // Louisiana requires specific licensing for intoxicating hemp
] as const;

/** All 51 US jurisdictions (50 states + DC) — default ship_to_states value. */
export const ALL_US_STATES: readonly string[] = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
] as const;
