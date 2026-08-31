/**
 * Shared anti-spam / bot-detection helpers for public forms.
 *
 * Layers (no external services, no cost):
 *  1. Honeypot — a hidden field real users never fill; bots auto-fill it.
 *  2. Timing trap — forms submitted faster than a human can type are bots.
 *  3. Email verdict — disposable domains and gmail dot-stuffing (the
 *     pattern behind the spam wave: `j.o.h.n.d.o.e@gmail.com` aliases).
 *  4. normalizeEmail — canonical form for dedupe/rate-limiting
 *     (gmail ignores dots and +tags; bots exploit that for "unique" emails).
 *
 * All pure functions — unit-testable without env or network.
 */

/** Field name deliberately attractive to autofill bots. Render hidden via CSS. */
export const HONEYPOT_FIELD = "company_website_url";
/** Hidden field carrying the server render timestamp (ms epoch). */
export const FORM_TS_FIELD = "form_ts";

const MIN_FILL_SECONDS = 3;
/** Reject a form_ts older than a day — replayed/stale tokens. */
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

/** Common disposable / throwaway email domains seen in signup abuse. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "mintemail.com",
  "mohmal.com",
  "trashmail.com",
  "trashmail.de",
  "fakeinbox.com",
  "mailnesia.com",
  "spamgourmet.com",
  "mytemp.email",
  "burnermail.io",
  "emailondeck.com",
  "moakt.com",
  "tmpmail.org",
  "tmpmail.net",
  "inboxkitten.com",
  "mail-temp.com",
  "linshiyouxiang.net",
  "temp-mail.io",
  "etempmail.net",
  "cloudtempmail.com",
]);

/** Gmail local parts with this many dots or more are treated as bot aliases. */
const GMAIL_DOT_LIMIT = 3;

export type SpamVerdict = {
  block: boolean;
  reason?: "invalid" | "disposable_domain" | "gmail_dot_alias";
};

function splitEmail(raw: string): { local: string; domain: string } | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!/^[^\s@]+$/.test(local) || !/^[^\s@]+\.[^\s@]+$/.test(domain)) {
    return null;
  }
  return { local, domain };
}

/** Decide whether an email address looks like spam/bot input. */
export function emailSpamVerdict(rawEmail: string): SpamVerdict {
  const parts = splitEmail(rawEmail);
  if (!parts) return { block: true, reason: "invalid" };
  const { local, domain } = parts;

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { block: true, reason: "disposable_domain" };
  }

  if (domain === "gmail.com" || domain === "googlemail.com") {
    const dots = local.split(".").length - 1;
    if (dots >= GMAIL_DOT_LIMIT) {
      return { block: true, reason: "gmail_dot_alias" };
    }
  }

  return { block: false };
}

/**
 * Canonical form of an email for dedupe and rate limiting.
 * Gmail: dots and +tags in the local part are ignored by Google, so
 * j.o.h.n+x@gmail.com → john@gmail.com. Other domains: only +tags stripped.
 */
export function normalizeEmail(rawEmail: string): string {
  const parts = splitEmail(rawEmail);
  if (!parts) return rawEmail.trim().toLowerCase();
  let { local } = parts;
  const { domain } = parts;
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

/** True when the honeypot field was filled — i.e. a bot submitted the form. */
export function honeypotTripped(value: FormDataEntryValue | string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * True when the form came back faster than a human could fill it,
 * or carries a missing/garbage/stale timestamp.
 * `now` is injectable for tests.
 */
export function timingTripped(
  tsValue: FormDataEntryValue | string | null,
  now: number = Date.now()
): boolean {
  if (typeof tsValue !== "string") return true;
  const ts = Number(tsValue);
  if (!Number.isFinite(ts) || ts <= 0) return true;
  const elapsed = now - ts;
  if (elapsed < MIN_FILL_SECONDS * 1000) return true;
  if (elapsed > MAX_FORM_AGE_MS) return true;
  return false;
}

/**
 * One-call gate for server actions: returns a block reason string or null.
 * Logs nothing itself — callers decide how to log/respond.
 */
export function formSpamCheck(params: {
  honeypot: FormDataEntryValue | null;
  formTs: FormDataEntryValue | null;
  email: string;
  now?: number;
}): string | null {
  if (honeypotTripped(params.honeypot)) return "honeypot";
  if (timingTripped(params.formTs, params.now)) return "timing";
  const verdict = emailSpamVerdict(params.email);
  if (verdict.block) return verdict.reason ?? "email";
  return null;
}

/** Clock helpers kept outside React components (react-hooks/purity). */
export function nowMs(): number {
  return Date.now();
}

/** True when fewer than minSeconds have passed since startMs (0 = unknown, passes). */
export function submittedTooFast(startMs: number, minSeconds = 3): boolean {
  if (!startMs) return false;
  return Date.now() - startMs < minSeconds * 1000;
}
