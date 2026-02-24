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

### Gotchas

- `.env.local` must exist with at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (even placeholders) or the Supabase client will throw at import time and many pages will 500.
- The `npm run lint` command exits non-zero due to pre-existing lint errors in the codebase — this is expected and not caused by setup.
- Node.js v22.x is required (matches `package-lock.json` lockfileVersion 3 and Next.js 16 requirements).
- The `.cursorrules` file says to run `powershell scripts/ai_autopush.ps1` after changes — this is Windows-specific and won't work in Linux cloud VMs. Use standard `git add/commit/push` instead.
- Playwright E2E tests (`npm run audit:prod`) require browser binaries installed via `npx playwright install` — not installed by default.
