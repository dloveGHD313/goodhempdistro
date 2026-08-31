import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { emailSpamVerdict, normalizeEmail } from "@/lib/server/antiSpam";

function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRe.test(trimmed);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const source = typeof body?.source === "string" ? body.source : null;

    if (!isValidEmail(rawEmail)) {
      return NextResponse.json(
        { ok: false, error: "Valid email is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Bot gate: disposable domains and gmail dot-alias stuffing get a
    // generic OK (bots learn nothing) without a database write.
    const verdict = emailSpamVerdict(rawEmail);
    if (verdict.block) {
      console.warn("[newsletter] blocked signup:", verdict.reason);
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Store the canonical address so dot/+tag aliases can't create dupes.
    const email = normalizeEmail(rawEmail);
    const admin = getSupabaseAdminClient();

    const { error } = await admin
      .from("newsletter_signups")
      .insert({ email, source: source || "learning-with-jax" });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { ok: true },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { ok: false, error: "Signup failed. Please try again." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRe.test(trimmed);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const source = typeof body?.source === "string" ? body.source : null;

    if (!isValidEmail(rawEmail)) {
      return NextResponse.json(
        { ok: false, error: "Valid email is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const email = rawEmail.trim().toLowerCase();
    const admin = getSupabaseAdminClient();

    const { error } = await admin
      .from("newsletter_signups")
      .insert({ email, source: source || "learning-with-jax" });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { ok: true },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { ok: false, error: "Signup failed. Please try again." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
