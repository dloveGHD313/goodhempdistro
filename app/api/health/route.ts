import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthStatus = "ok" | "fail" | "missing";

/**
 * Production-safe health check. No auth, no writes, no secrets.
 * GET /api/health => { ok, db, storage, stripe }
 */
export async function GET() {
  const result: {
    ok: boolean;
    db: HealthStatus;
    storage: HealthStatus;
    stripe: HealthStatus;
  } = {
    ok: true,
    db: "fail",
    storage: "fail",
    stripe: process.env.STRIPE_SECRET_KEY?.trim() ? "ok" : "missing",
  };

  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin.from("profiles").select("id").limit(1).maybeSingle();
    result.db = error ? "fail" : "ok";
  } catch {
    result.db = "fail";
  }

  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin.storage.from("coas").list("", { limit: 1 });
    result.storage = error ? "fail" : "ok";
  } catch {
    result.storage = "fail";
  }

  result.ok = result.db === "ok" && result.storage === "ok";
  const status = result.ok ? 200 : 503;
  return NextResponse.json(result, { status });
}
