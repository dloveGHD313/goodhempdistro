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

function getDailyGlobalCap(): number {
  const raw = process.env.JAX_DAILY_GLOBAL_CAP?.trim();
  if (!raw) return JAX_DAILY_GLOBAL_CAP_DEFAULT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : JAX_DAILY_GLOBAL_CAP_DEFAULT;
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
 */
export async function getGlobalDailyCount(): Promise<number> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("jax_global_daily")
      .select("message_count")
      .eq("day_utc", currentDayUtc())
      .maybeSingle();
    const count = (data as { message_count?: number } | null)?.message_count;
    return typeof count === "number" ? count : 0;
  } catch {
    return 0;
  }
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

export const JAX_USAGE_HELPERS = {
  getDailyGlobalCap,
  currentMonthYearUtc,
  currentDayUtc,
};
