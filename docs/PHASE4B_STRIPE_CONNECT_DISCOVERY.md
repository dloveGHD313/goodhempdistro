
## 10) Driver/logistics schema excerpt (exact table/FK evidence)

From `supabase/migrations/005_compliance_logistics.sql`:

```sql
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  ...
  payout_cents INT NOT NULL DEFAULT 0 CHECK (payout_cents >= 0),
  ...
);
```

From `supabase/migrations/073_phase5_logistics_delivery.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.logistics_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ...
);

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF EXISTS (... table_name = 'drivers' AND column_name = 'user_id') THEN
    ALTER TABLE drivers ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;
```

Relation evidence found in schema:
- `deliveries.driver_id -> drivers.id` (existing FK)
- No FK from `logistics_applications` to `drivers` (and no `driver_id` / `application_id` relation column).

Stripe Connect fields currently present:
- `vendor_connect_accounts.stripe_account_id` (`supabase/migrations/069_vendor_connect.sql`)
- `affiliates.stripe_account_id` (`supabase/migrations/071_affiliates_phase7.sql`)
- No driver/logistics Stripe connect column currently exists.
