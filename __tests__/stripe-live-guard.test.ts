import { describe, it, expect, afterEach, vi } from "vitest";
import {
  assertStripeLiveSecret,
  assertStripeWebhookSecret,
  isStripeProductionEnv,
} from "@/lib/stripe/liveGuard";

/**
 * Env-gating contract for Stripe key enforcement.
 *
 * PRODUCTION: live keys only (sk_live_), test-mode webhook events rejected.
 * PREVIEW/DEV: sk_test_ keys allowed — required by the test-mode smoke
 * checklist which runs against Vercel preview deploys.
 *
 * Critical detail: Vercel PREVIEW builds run with NODE_ENV=production, so
 * env detection MUST prefer VERCEL_ENV when present. The old
 * isProduction() in lib/env/stripeEnv.ts OR'd NODE_ENV=production and
 * therefore enforced live keys on preview — that's the bug this pins.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isStripeProductionEnv — VERCEL_ENV is authoritative", () => {
  it("true when VERCEL_ENV=production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    expect(isStripeProductionEnv()).toBe(true);
  });

  it("FALSE when VERCEL_ENV=preview even though NODE_ENV=production (the Vercel preview-build case)", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    expect(isStripeProductionEnv()).toBe(false);
  });

  it("false when VERCEL_ENV=development", () => {
    vi.stubEnv("VERCEL_ENV", "development");
    expect(isStripeProductionEnv()).toBe(false);
  });

  it("falls back to NODE_ENV when VERCEL_ENV is absent (non-Vercel runs)", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isStripeProductionEnv()).toBe(true);
    vi.stubEnv("NODE_ENV", "test");
    expect(isStripeProductionEnv()).toBe(false);
  });
});

describe("assertStripeLiveSecret — production", () => {
  it("throws on sk_test_ in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc123");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => assertStripeLiveSecret()).toThrow(/live key/);
    errSpy.mockRestore();
  });

  it("passes on sk_live_ in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc123");
    expect(() => assertStripeLiveSecret()).not.toThrow();
  });

  it("throws on missing key in any environment", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(() => assertStripeLiveSecret()).toThrow(/required/);
  });
});

describe("assertStripeLiveSecret — preview/dev allow test keys", () => {
  it("passes on sk_test_ when VERCEL_ENV=preview (test-mode smoke case) with a warning", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production"); // Vercel preview builds do this
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc123");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => assertStripeLiveSecret()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("TEST-MODE"));
    warnSpy.mockRestore();
  });

  it("passes on sk_live_ in preview too (live keys never blocked)", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc123");
    expect(() => assertStripeLiveSecret()).not.toThrow();
  });

  it("passes on sk_test_ in local development", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc123");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => assertStripeLiveSecret()).not.toThrow();
    warnSpy.mockRestore();
  });
});

describe("assertStripeWebhookSecret — format required in every environment", () => {
  it("throws on missing secret", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(() => assertStripeWebhookSecret()).toThrow(/required/);
  });

  it("throws on wrong format", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "not-a-secret");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => assertStripeWebhookSecret()).toThrow(/whsec_/);
    errSpy.mockRestore();
  });

  it("passes on whsec_ regardless of environment (test endpoints have their own whsec_)", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");
    expect(() => assertStripeWebhookSecret()).not.toThrow();
  });
});
