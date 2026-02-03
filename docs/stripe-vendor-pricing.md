# Stripe Vendor Pricing

Vendor checkout uses **Stripe PRICE IDs only**. Product IDs are not used.

## Rules

- **Checkout** `line_items` must use `price: "price_..."` only. Never use `prod_...` for checkout session creation.
- **Env vars**: Set only `*_PRICE_ID` for vendor plans. `*_PRODUCT_ID` vars are **not used** and should be removed or left unset.
- **Validation**: Values must start with `price_`. If an env value is `prod_...` or anything else, it is treated as invalid and checkout will fail with a clear error.

## Required vendor PRICE_ID env vars (key names only)

Set these in Vercel → Environment Variables (or `.env.local`):

- `STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID`
- `STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID`
- `STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID`
- `STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID`
- `STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID`
- `STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID`

Each value must be a Stripe Price ID (e.g. `price_...`). Do not set Product IDs.

## Common error responses

| Response | Meaning |
|----------|--------|
| `Vendor billing not configured` (500) | One or more required PRICE_ID env vars are missing or invalid. Check `missingEnv` / `invalidEnv` in the JSON body (key names only). |
| `Invalid vendor plan selection` (400) | The requested planKey/cadence does not resolve to a valid price, or env contains non–price_ values. |
| `Failed to create checkout session` (500) | Stripe rejected the request or server error. Use `requestId` and `errorReason` / logs to debug. |

## Validation script

Run locally or in CI:

```bash
node scripts/validate-stripe-env.mjs
```

Exits non-zero if any required vendor PRICE_ID key is missing or its value does not start with `price_`.
