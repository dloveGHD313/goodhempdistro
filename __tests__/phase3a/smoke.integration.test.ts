/**
 * Phase 3A: Optional integration smoke tests.
 * Skipped when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set.
 */
import { describe, expect, it, beforeAll } from "vitest";

const hasSupabaseEnv =
  !!process.env.SUPABASE_URL?.trim() && !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

describe("Phase 3A: smoke integration", () => {
  beforeAll(() => {
    if (!hasSupabaseEnv) {
      console.warn(
        "[phase3a] Skipping integration smoke: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set"
      );
    }
  });

  it(
    "connects to Supabase (profiles table readable)",
    { skip: !hasSupabaseEnv },
    async () => {
      const { getSupabaseAdminClient } = await import("@/lib/supabaseAdmin");
      const admin = getSupabaseAdminClient();
      const { data, error } = await admin.from("profiles").select("id").limit(1).maybeSingle();
      expect(error).toBeNull();
      expect(data === null || (typeof data === "object" && "id" in data)).toBe(true);
    }
  );
});
