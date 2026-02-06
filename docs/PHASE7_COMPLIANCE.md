# Phase 7: State Rules & Compliance

## State rules (sale & delivery)

- **Table:** `public.hemp_state_rules`
- **Columns:** `state_code` (PK), `allows_sale_non_intoxicating`, `allows_delivery_non_intoxicating`, `allows_sale_intoxicating`, `allows_delivery_intoxicating`, `notes`, `sources` (JSONB), `last_verified_at`, `updated_by`
- **Default-safe:** If no row exists for a state, delivery is **not** allowed for both categories; sale is treated as allowed for non-intoxicating (platform default).
- **Checkout:** When `delivery_selected` is true, `customer_state` (2-letter) is required. Delivery is blocked when the state rule disallows delivery for that product category (intoxicating vs non-intoxicating). When fulfillment is pickup/shipping, sale is blocked if the state disallows sale for that category.
- **Delta-8:** Not allowed on platform; products with `is_delta8 = true` or `product_type = 'delta8'` cannot be active or purchased.

## Product classification

- **Columns on `products`:** `is_intoxicating`, `is_delta8` (migration `076_phase7_product_compliance_classification.sql`).
- **Constraint:** No product can be `active = true` and `is_delta8 = true`.
- Backfill from existing `product_type`: `intoxicating` → `is_intoxicating = true`; `delta8` → `is_delta8 = true`.

## How to update / import state rules

1. **Admin only:** Only users in `admin_users` can INSERT/UPDATE `hemp_state_rules`.
2. **Sources required:** Each state row should have `sources` as a JSONB array of `{ "url", "title", "publisher", "accessed_at" }`. Do not claim legality without at least one authoritative source (state statute, agency, or AG guidance).
3. **Import flow (future):** Admin UI can accept pasted JSON and validate then insert/update. Template: one object per state with `state_code`, `allows_sale_*`, `allows_delivery_*`, `sources`.
4. **Verification:** Set `last_verified_at` when rules are reviewed; use `notes` for caveats.

## Env

No new env vars for state rules. Stripe and Supabase remain as before.
