import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClientIp,
  interpretSiteverify,
  isTurnstileEnabled,
  requireHumanFromRequest,
  requireHumanFromForm,
  TURNSTILE_FIELD,
  TURNSTILE_REJECT_MESSAGE,
  verifyTurnstileToken,
} from "@/lib/server/turnstile";

const ORIGINAL_ENV = { ...process.env };

function setKeys(site = "1x00000000000000000000AA", secret = "1x0000000000000000000000000000000AA") {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = site;
  process.env.TURNSTILE_SECRET_KEY = secret;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("turnstile flag", () => {
  it("is OFF when either key is missing", () => {
    expect(isTurnstileEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site";
    expect(isTurnstileEnabled()).toBe(false);
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.TURNSTILE_SECRET_KEY = "secret";
    expect(isTurnstileEnabled()).toBe(false);
  });

  it("is ON only when both keys are set", () => {
    setKeys();
    expect(isTurnstileEnabled()).toBe(true);
  });

  it("flag OFF: every check passes without a network call", async () => {
    const fetchMock = vi.fn();
    const result = await verifyTurnstileToken(null, null, fetchMock);
    expect(result).toEqual({ ok: true, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await requireHumanFromForm(new FormData())).toBeNull();
    expect(await requireHumanFromRequest(new Request("http://x"), {})).toBeNull();
  });
});

describe("verifyTurnstileToken (flag ON)", () => {
  beforeEach(() => setKeys());

  it("fails closed on a missing or oversized token", async () => {
    const fetchMock = vi.fn();
    expect(await verifyTurnstileToken("", null, fetchMock)).toEqual({ ok: false, reason: "missing" });
    expect(await verifyTurnstileToken(undefined, null, fetchMock)).toEqual({ ok: false, reason: "missing" });
    expect(await verifyTurnstileToken("x".repeat(3000), null, fetchMock)).toEqual({ ok: false, reason: "missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts secret + response + remoteip to siteverify and accepts success", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const params = new URLSearchParams(String(init?.body));
      expect(params.get("secret")).toBe(process.env.TURNSTILE_SECRET_KEY);
      expect(params.get("response")).toBe("tok_123");
      expect(params.get("remoteip")).toBe("203.0.113.9");
      return jsonResponse({ success: true });
    });
    const result = await verifyTurnstileToken("tok_123", "203.0.113.9", fetchMock);
    expect(result).toEqual({ ok: true, skipped: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("rejects when Cloudflare says the token is invalid", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }));
    expect(await verifyTurnstileToken("bad", null, fetchMock)).toEqual({ ok: false, reason: "invalid" });
  });

  it("fails closed when siteverify is unreachable or returns garbage", async () => {
    const down = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await verifyTurnstileToken("tok", null, down)).toEqual({ ok: false, reason: "unavailable" });
    const http500 = vi.fn(async () => new Response("nope", { status: 500 }));
    expect(await verifyTurnstileToken("tok", null, http500)).toEqual({ ok: false, reason: "unavailable" });
    const garbage = vi.fn(async () => new Response("not json", { status: 200 }));
    expect(await verifyTurnstileToken("tok", null, garbage)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("helpers", () => {
  it("interpretSiteverify only trusts success === true", () => {
    expect(interpretSiteverify({ success: true })).toEqual({ ok: true, skipped: false });
    expect(interpretSiteverify({ success: "true" })).toEqual({ ok: false, reason: "invalid" });
    expect(interpretSiteverify(null)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("getClientIp prefers the first x-forwarded-for hop", () => {
    const h = new Headers({ "x-forwarded-for": "198.51.100.4, 10.0.0.1", "x-real-ip": "10.0.0.2" });
    expect(getClientIp(h)).toBe("198.51.100.4");
    expect(getClientIp(new Headers({ "x-real-ip": "10.0.0.2" }))).toBe("10.0.0.2");
    expect(getClientIp(new Headers())).toBeNull();
    expect(getClientIp(null)).toBeNull();
  });

  it("form + request wrappers return the generic rejection when the flag is ON and no token is sent", async () => {
    setKeys();
    const fd = new FormData();
    expect(await requireHumanFromForm(fd)).toBe(TURNSTILE_REJECT_MESSAGE);
    fd.set(TURNSTILE_FIELD, "");
    expect(await requireHumanFromForm(fd)).toBe(TURNSTILE_REJECT_MESSAGE);
    expect(await requireHumanFromRequest(new Request("http://x"), { email: "a@b.co" })).toBe(
      TURNSTILE_REJECT_MESSAGE
    );
  });
});
