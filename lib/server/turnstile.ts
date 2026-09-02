/**
 * Cloudflare Turnstile — server-side human verification for public forms.
 *
 * CEO direction (2026-08-31): "all real traffic, no fake accounts or spam
 * accounts." The honeypot/timing layer in antiSpam.ts stops dumb bots; this
 * adds a real challenge that scripted submitters can't skip.
 *
 * FEATURE FLAG: verification is ON only when BOTH env vars are set —
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  (public, rendered into the widget)
 *   TURNSTILE_SECRET_KEY            (server-only, used for siteverify)
 * With either missing, every check passes and no widget renders — zero
 * behavior change until the keys land in Vercel. CEO pastes the values.
 *
 * When ON, verification FAILS CLOSED: a missing, invalid, expired, or
 * unverifiable token rejects the submission.
 */

export const TURNSTILE_FIELD = "cf-turnstile-response";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5000;

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: "missing" | "invalid" | "unavailable" };

const trimmed = (v?: string) => (v ?? "").trim();

export function getTurnstileSiteKey(): string {
  return trimmed(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/** ON only when both halves of the key pair exist. */
export function isTurnstileEnabled(): boolean {
  return getTurnstileSiteKey().length > 0 && trimmed(process.env.TURNSTILE_SECRET_KEY).length > 0;
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(headers: Headers | null | undefined): string | null {
  if (!headers) return null;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  return real ? real.trim() : null;
}

/** Pure: interpret a siteverify JSON body. Exported for tests. */
export function interpretSiteverify(body: unknown): TurnstileResult {
  if (!body || typeof body !== "object") return { ok: false, reason: "unavailable" };
  const success = (body as { success?: unknown }).success;
  return success === true ? { ok: true, skipped: false } : { ok: false, reason: "invalid" };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Verify a Turnstile token with Cloudflare.
 * - Flag OFF → { ok: true, skipped: true } (no network call).
 * - Flag ON  → real verification, fail closed.
 */
export async function verifyTurnstileToken(
  token: FormDataEntryValue | string | null | undefined,
  remoteIp?: string | null,
  fetchImpl: FetchLike = fetch
): Promise<TurnstileResult> {
  if (!isTurnstileEnabled()) return { ok: true, skipped: true };

  const value = typeof token === "string" ? token.trim() : "";
  if (!value || value.length > 2048) return { ok: false, reason: "missing" };

  const form = new URLSearchParams();
  form.set("secret", trimmed(process.env.TURNSTILE_SECRET_KEY));
  form.set("response", value);
  if (remoteIp) form.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const json = await res.json().catch(() => null);
    return interpretSiteverify(json);
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

/** Human-readable rejection for forms/APIs (no detail bots can learn from). */
export const TURNSTILE_REJECT_MESSAGE =
  "We couldn't verify you're human. Please refresh the page and try again.";

/**
 * Convenience for server actions: pull the token off FormData and verify.
 * Returns null when OK, or the rejection message when the submission should
 * be refused.
 */
export async function requireHumanFromForm(
  formData: FormData,
  headers?: Headers | null
): Promise<string | null> {
  const result = await verifyTurnstileToken(formData.get(TURNSTILE_FIELD), getClientIp(headers));
  if (result.ok) return null;
  console.warn("[turnstile] rejected form submission:", result.reason);
  return TURNSTILE_REJECT_MESSAGE;
}

/**
 * Convenience for JSON API routes: token comes from the body
 * (`turnstileToken`) or the `x-turnstile-token` header.
 */
export async function requireHumanFromRequest(
  req: Request,
  body: unknown
): Promise<string | null> {
  const fromBody =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).turnstileToken === "string"
      ? ((body as Record<string, unknown>).turnstileToken as string)
      : null;
  const token = fromBody ?? req.headers.get("x-turnstile-token");
  const result = await verifyTurnstileToken(token, getClientIp(req.headers));
  if (result.ok) return null;
  console.warn("[turnstile] rejected API submission:", result.reason);
  return TURNSTILE_REJECT_MESSAGE;
}
