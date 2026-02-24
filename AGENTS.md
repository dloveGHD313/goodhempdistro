# Good Hemp Distro – Agent Rules

See `public/AGENTS.md` for brand/UI rules, route requirements, and commit workflow.

## Cursor Cloud specific instructions

### Services overview

| Service | Purpose | Required? |
|---------|---------|-----------|
| Next.js dev server (`npm run dev`) | App on `localhost:3000` | Yes |
| Supabase (hosted) | Auth, DB, storage | Yes (needs real env vars for full functionality) |
| Stripe (hosted) | Payments, subscriptions | Yes (needs real keys for checkout/billing flows) |
| OpenAI | Mascot chatbot "Jax" | No (disabled by default via `MASCOT_AI_ENABLED=false`) |

### Running the dev server

```bash
npm run dev          # starts Next.js on port 3000 (Turbopack)
```

Without real Supabase/Stripe credentials the app still starts and serves static pages (`/welcome`, `/about`, `/pricing`, `/contact`, etc.). Authenticated routes will error at runtime until real `.env.local` values are provided.

### Lint / Test / Build

```bash
npm run lint                  # ESLint (pre-existing warnings/errors in codebase)
npm run test -- --run         # Vitest unit tests (all pass without external services)
npm run build                 # Next.js production build (Turbopack)
npm run typecheck             # TypeScript check without full build
```

### Environment secrets

The following secrets must be injected as environment variables (configured via Cursor Secrets) for full functionality. Without them the app starts but auth/payment features fail at runtime.

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (admin APIs) |
| `STRIPE_SECRET_KEY` | Stripe server-side key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client-side key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

When these are available, write `.env.local` at startup using them (the update script does **not** do this — agents must create `.env.local` from the env vars on first run if it doesn't exist).

### Gotchas

- `.env.local` must exist with at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (even placeholders) or the Supabase client will throw at import time and many pages will 500.
- The `npm run lint` command exits non-zero due to pre-existing lint errors in the codebase — this is expected and not caused by setup.
- Node.js v22.x is required (matches `package-lock.json` lockfileVersion 3 and Next.js 16 requirements).
- The `.cursorrules` file says to run `powershell scripts/ai_autopush.ps1` after changes — this is Windows-specific and won't work in Linux cloud VMs. Use standard `git add/commit/push` instead.
- Playwright E2E tests (`npm run audit:prod`) require browser binaries installed via `npx playwright install` — not installed by default.
- Supabase email confirmation is enabled — signing up creates an account but the user cannot log in until the confirmation link is clicked. For testing auth flows, either disable email confirmation in the Supabase dashboard or use the Supabase service-role key to confirm users programmatically.
