# Bot / Human Verification (Cloudflare Turnstile)

CEO direction (2026-08-31): "all real traffic, no fake accounts or spam accounts."
Evidence (2026-09-01 audit): 46 spam JAX feature applications, ~15 spam contact-form
submissions on the old site, a driver-application queue that was mostly spam.

## What ships in this PR

**Nothing changes until the keys are set.** Every check below is a no-op while either
env var is missing, and the widget renders nothing. This is a pure feature flag.

| Layer | Where | Behavior when ON |
|---|---|---|
| `lib/server/turnstile.ts` | server | `verifyTurnstileToken` calls Cloudflare siteverify; **fails closed** (missing/invalid/unreachable → reject) |
| `components/TurnstileWidget.tsx` | client | Renders the Turnstile challenge (dark theme, flexible width); passes token to the form |
| Server-action forms | JAX application, project submission, wholesale inquiry | Token read from `cf-turnstile-response`; rejection → `?error=human` banner |
| JSON API routes | `/api/contact`, `/api/newsletter/subscribe`, `/api/vendors/create`, `/api/drivers/apply/init`, `/api/logistics/apply/on-demand-driver`, `…-with-docs` | Token from body `turnstileToken` or header `x-turnstile-token`; rejection → HTTP 403 |
| Supabase Auth | signup, login, forgot/reset password | Token forwarded as `captchaToken`; **Supabase** verifies it once Bot Protection is enabled in the dashboard |
| Contact form | `/api/contact` | Also gained the server-side honeypot + disposable-email gate it never had |

Existing honeypot/timing/email-pattern gates (`lib/server/antiSpam.ts`) stay in place in
front of Turnstile, so cheap bots are still dropped without a Cloudflare round-trip.

## Rollout runbook (DeMarcus — ~15 minutes, no code)

1. **Cloudflare dashboard → Turnstile → Add widget.**
   - Hostname: `goodhempdistro.com` (add `www.goodhempdistro.com` and the Vercel preview
     domain if you want it on previews).
   - Widget mode: **Managed** (invisible for most humans; shows a checkbox only when unsure).
   - Copy the **Site Key** and **Secret Key**.
2. **Vercel → Project → Settings → Environment Variables** (Production; Preview optional):
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = site key
   - `TURNSTILE_SECRET_KEY` = secret key (server-only — never prefix with NEXT_PUBLIC)
   - Redeploy (any push to main, or "Redeploy" in Vercel).
3. **Supabase → Authentication → Attack Protection → Bot and Abuse Protection**:
   - Enable, provider **Turnstile**, paste the same **Secret Key**.
   - From this point Supabase requires a captcha token on sign-up, password sign-in,
     and password-reset. The forms already send it.
   - ⚠️ Do step 3 only AFTER step 2 has deployed, or signups/logins will fail with
     "captcha verification process failed" until the widget renders.
4. **Verify on production:** open /signup, /contact, /vendor-registration, /learning/jax —
   the Turnstile badge/checkbox should appear above each submit button. Submit one real
   test on /contact; it should succeed. Then the spam should stop.

### Rollback
Delete the two Vercel env vars and redeploy (and disable Bot Protection in Supabase).
Everything reverts to the honeypot-only behavior. No data migration involved.

## Testing keys (local / preview only)
Cloudflare publishes always-pass test keys:
- Site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` → always passes
- Site key `2x00000000000000000000AB`, secret `2x0000000000000000000000000000000AA` → always blocks
Never put test keys in Production.

## Not in this PR (follow-ups)
- IP/email rate limiting on `/api/posts`, comments, likes (authenticated abuse) — needs a
  shared store (Upstash) or a DB-count helper; not needed to stop the anonymous spam wave.
- `/api/contact` still only logs; wiring it to email/DB is a separate task.
- Turnstile on the community post composer (auth-gated today).
