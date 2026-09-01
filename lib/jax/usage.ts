/**
 * Build 10: thin wrappers over the atomic Postgres increment functions
 * defined in supabase/migrations/20260501020000_jax_usage.sql.
 *
 * Reads (cap checks) are non-atomic by design — the read-then-RPC pattern
 * is fine because the RPC itself is atomic and returns the post-increment
 * count. Cap enforcement happens BEFORE the OpenAI call using the read,
 * and the increment runs AFTER OpenAI succeeds (so failed/transient
 * upstream errors don't burn quota).
 */

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const JAX_DAILY_GLOBAL_CAP_DEFAULT = 5000;

/**
 * Phase 5: $50/month global HARD CUTOFF (cost circuit breaker).
 *
 * gpt-4o-mini pricing, expressed in CENTS PER TOKEN:
 *   input  $0.15 / 1M tokens = 15 cents / 1M = 0.000015 cents per token
 *   output $0.60 / 1M tokens = 60 cents / 1M = 0.00006  cents per token
 * The search-preview model bills slightly differently; these constants are a
 * circuit breaker, not accounting — same rates are applied to both.
 *
 * Cost is COMPUTED FROM MONTHLY TOKEN SUMS at read time. Storing rounded
 * per-call cents would floor a ~500-token call ($0.0001) to 0 forever.
 */
export const JAX_GPT4O_MINI_INPUT_CENTS_PER_TOKEN = 15 / 1_000_000;
export const JAX_GPT4O_MINI_OUTPUT_CENTS_PER_TOKEN = 60 / 1_000_000;
export const JAX_MONTHLY_GLOBAL_COST_CAP_CENTS_DEFAULT = 5000; // $50

function getDailyGlobalCap(): number {
  const raw = process.env.JAX_DAILY_GLOBAL_CAP?.trim();
  if (!raw) return JAX_DAILY_GLOBAL_CAP_DEFAULT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : JAX_DAILY_GLOBAL_CAP_DEFAULT;
}

export function getMonthlyGlobalCostCapCents(): number {
  const raw = process.env.JAX_MONTHLY_GLOBAL_COST_CAP_CENTS?.trim();
  if (!raw) return JAX_MONTHLY_GLOBAL_COST_CAP_CENTS_DEFAULT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : JAX_MONTHLY_GLOBAL_COST_CAP_CENTS_DEFAULT;
}

/** Cents for a token count pair. Pure — used by the monthly read and tests. */
export function computeCostCents(inputTokens: number, outputTokens: number): number {
  const inTok = Number.isFinite(inputTokens) && inputTokens > 0 ? inputTokens : 0;
  const outTok = Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0;
  return (
    inTok * JAX_GPT4O_MINI_INPUT_CENTS_PER_TOKEN +
    outTok * JAX_GPT4O_MINI_OUTPUT_CENTS_PER_TOKEN
  );
}

function currentMonthYearUtc(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function currentDayUtc(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Read the current month's message count for a user. Returns 0 when no
 * row exists yet. Does not increment.
 */
export async function getUserMonthlyCount(userId: string): Promise<number> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("jax_usage")
      .select("message_count")
      .eq("user_id", userId)
      .eq("month_year", currentMonthYearUtc())
      .maybeSingle();
    const count = (data as { message_count?: number } | null)?.message_count;
    return typeof count === "number" ? count : 0;
  } catch {
    return 0;
  }
}

/**
 * Read the current day's global message count. Returns 0 when no row
 * exists yet. Does not increment.
 *
 * THROWS on DB error. The circuit breaker MUST fail closed — silently
 * returning 0 here would disable cost protection at exactly the moment
 * we most need it (e.g. a DB hiccup during a usage spike).
 */
export async function getGlobalDailyCount(): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("jax_global_daily")
    .select("message_count")
    .eq("day_utc", currentDayUtc())
    .maybeSingle();
  if (error) {
    throw new Error(`jax_global_daily read failed: ${error.message}`);
  }
  const count = (data as { message_count?: number } | null)?.message_count;
  return typeof count === "number" ? count : 0;
}

/**
 * Atomic per-user monthly increment. Returns the post-increment count.
 */
export async function incrementUserMonthly(userId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("jax_increment_user_monthly", {
    p_user_id: userId,
  });
  if (error) throw error;
  const count = typeof data === "number" ? data : Number(data);
  return Number.isFinite(count) ? count : 0;
}

/**
 * Atomic global daily increment. Returns the post-increment count.
 */
export async function incrementGlobalDaily(): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("jax_increment_global_daily");
  if (error) throw error;
  const count = typeof data === "number" ? data : Number(data);
  return Number.isFinite(count) ? count : 0;
}

/**
 * Atomic global daily increment INCLUDING token counters (Phase 5 cost cap).
 * Returns the post-increment message count.
 */
export async function incrementGlobalDailyWithCost(
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("jax_increment_global_daily_with_cost", {
    p_input_tokens: Math.max(0, Math.round(inputTokens) || 0),
    p_output_tokens: Math.max(0, Math.round(outputTokens) || 0),
  });
  if (error) throw error;
  const count = typeof data === "number" ? data : Number(data);
  return Number.isFinite(count) ? count : 0;
}

/**
 * Sum this UTC month's global JAX cost in cents from the daily token counters.
 *
 * THROWS on DB error — the $50/month circuit breaker MUST fail closed, same
 * rationale as getGlobalDailyCount above.
 */
export async function getCurrentMonthCostCents(): Promise<number> {
  const admin = createSupabaseAdminClient();
  const monthStart = `${currentMonthYearUtc()}-01`;
  const { data, error } = await admin
    .from("jax_global_daily")
    .select("input_tokens, output_tokens")
    .gte("day_utc", monthStart);
  if (error) {
    throw new Error(`jax_global_daily month read failed: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{
    input_tokens?: number | null;
    output_tokens?: number | null;
  }>;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const row of rows) {
    inputTokens += typeof row.input_tokens === "number" ? row.input_tokens : 0;
    outputTokens += typeof row.output_tokens === "number" ? row.output_tokens : 0;
  }
  return computeCostCents(inputTokens, outputTokens);
}

export const JAX_USAGE_HELPERS = {
  getDailyGlobalCap,
  currentMonthYearUtc,
  currentDayUtc,
};
