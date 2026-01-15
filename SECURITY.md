# Security Guidelines

## Environment Variables

### What Are Environment Variables?
Environment variables store sensitive configuration data like API keys and database credentials. They should **never** be committed to version control.

### Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Replace placeholder values** in `.env.local` with your actual credentials:
   - Supabase URL and keys (from https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api)
   - Stripe keys (from https://dashboard.stripe.com/test/apikeys)

3. **Verify `.gitignore`** includes:
   ```
   .env
   .env.local
   .env*.local
   ```

### Critical: Rotating Leaked Secrets

**If secrets were committed to git:**

1. **Rotate all leaked credentials immediately:**
   - **Supabase:** Go to Settings → API → Generate new service_role key
   - **Stripe:** Go to Developers → API keys → Roll secret key
   - **Stripe Webhook:** Create new webhook endpoint and secret

2. **Check commit history:**
   ```bash
   git log --all --source --full-history -- '*env*'
   ```

3. **Remove from git history** (destructive):
   ```bash
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch .env .env.local" \
   --prune-empty --tag-name-filter cat -- --all
   ```

4. **Force push** (coordinate with team first):
   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```

### Leaked Secrets in This Repo

⚠️ **ACTION REQUIRED:** The following credentials were found in `.env.example` and must be rotated:

**Files containing secrets:**
- `.env.example` (commit history)

**Credentials to rotate:**
1. Supabase project: `rpxondvoydrcsommaved`
   - Anon key (JWT beginning with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
   - Service role key (JWT beginning with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

2. Stripe account:
   - Test publishable key: `pk_test_51SoX28ERWHn4LV3L...`
   - Test secret key: `sk_test_51SoX28ERWHn4LV3L...`
   - Webhook secret: `whsec_l1ZWKKjDcBsRZYosz9Zi1pSnSMYZ0IZ0`

### Production Best Practices

1. **Use different keys for dev/staging/prod**
2. **Store production secrets in Vercel:**
   - Go to Project Settings → Environment Variables
   - Add each variable with appropriate environment scope
3. **Enable Vercel's Secret Scanning** to detect leaked credentials
4. **Audit access regularly:** Review who has access to production credentials

### Additional Resources
- [Supabase Security Guide](https://supabase.com/docs/guides/platform/going-into-prod)
- [Stripe Security Best Practices](https://stripe.com/docs/security/guide)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
