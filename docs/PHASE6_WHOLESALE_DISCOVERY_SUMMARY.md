# Phase 6 Wholesale Access Funnel — Discovery Summary

**No implementation until this summary is complete and approved. All paths and patterns are confirmed from repo.**

---

## 1) Supabase server client pattern

- **Server components / API routes**: Use `createSupabaseServerClient()` from `@/lib/supabase` (async; uses cookies). See `app/auth/callback/route.ts`, `app/api/profile/route.ts`, `app/wholesale/page.tsx`.
- **Admin / service-role**: Use `getSupabaseAdminClient()` or `getSupabaseAdminClientOrThrow()` from `@/lib/supabaseAdmin`. See `app/api/admin/drivers/applications/route.ts`, `lib/storageSignedUrls.ts`.

---

## 2) Storage upload pattern

- **Existing signed-url API**: `app/api/storage/signed-url/route.ts` — **POST** returns a **signed read URL** for an existing object (bucket + path). Uses `createSignedUrl()` from `@/lib/storageSignedUrls` (admin client, 600s TTL). Does **not** create upload URLs.
- **Upload patterns in repo**:
  - **COA**: `app/api/vendors/products/[id]/coa/route.ts` — **POST** with FormData; server uploads via `storage.from(COA_BUCKET).upload(storagePath, file)` (server client or admin). Returns `storage_path`.
  - **Client upload**: `app/vendors/products/[id]/edit/COAUpload.tsx` — POSTs file to COA API; then gets signed **read** URL for preview.
- **Supabase Storage**: `@supabase/storage-js` has `createSignedUploadUrl(path)` returning `{ signedUrl, path, token }`; client can then upload via that URL or `uploadToSignedUrl`. For Phase 6, **upload-url API** will: validate auth + filename/contentType, build path `wholesale-certificates/{userId}/{Date.now()}-{filename}`, call server Supabase client `storage.from('wholesale-certificates').createSignedUploadUrl(path)`, return `{ signedUrl, path }` (client uploads with fetch PUT to signedUrl or uses token).

---

## 3) Admin gate pattern

- **Two patterns in repo**:
  - **requireAdmin()** — `lib/auth/requireAdmin.ts`: no request; uses profile `role`/`roles` + `hasRole(profile, "admin")` and optional env allowlist. Used in: `app/api/admin/products/route.ts`, `app/api/admin/id-verifications/route.ts`, `app/admin/vendors/page.tsx` (server component).
  - **requireAdminUsers(req)** — `lib/auth/requireAdminUsers.ts`: takes `NextRequest`; checks `public.admin_users` table (SELECT by user_id). Used in: `app/api/admin/drivers/applications/route.ts`, `app/api/admin/diag/env/route.ts`, driver approve/reject, COA view.
- **RLS for applications**: `logistics_applications` uses `EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())` for admin SELECT/UPDATE. `vendor_applications` (older) uses `profiles.role = 'admin'`.
- **Phase 6 choice**: Use **requireAdminUsers(req)** for all **admin API routes** (align with driver applications and RLS). For **admin UI** page, use server-side check: fetch profile and `hasRole(profile, "admin")` or call requireAdmin(); admin list page can use same as admin vendors (requireAdmin + data fetch). RLS for `wholesale_applications` will use **admin_users** so API and RLS match.

---

## 4) Existing application table patterns

- **logistics_applications** (`073_phase5_logistics_delivery.sql`): id, created_at, type, full_name, email, phone, service_area, vehicle_type, notes, status (pending/approved/rejected), reviewed_by (uuid ref auth.users), reviewed_at, rejection_reason. No `updated_at` trigger in 073; other tables use `update_updated_at_column()` from `001_marketplace_core.sql` / `006_events.sql`.
- **vendor_applications** (`007_vendor_approval.sql`): id, user_id (ref profiles), business_name, description, status, created_at, updated_at; trigger `update_vendor_applications_updated_at` → `update_updated_at_column()`.
- **Shared trigger**: `public.update_updated_at_column()` in `001_marketplace_core.sql` and `006_events.sql` — sets `NEW.updated_at = NOW()`. Reuse for `wholesale_applications`.

---

## 5) Wholesale role assignment

- **lib/roles.ts**: `ALLOWED_ROLES` includes `"wholesale"`. `hasRole(profile, "wholesale")` uses `getRoles(profile)` (merges `roles` array and legacy `role`).
- **Onboarding**: `app/api/onboarding/submit/route.ts` — if `isConsumerWholesaleChoice(useType)` and roles include consumer, adds `"wholesale"` to `rolesToWrite` and persists to `profiles.roles`.
- **Destination**: `lib/onboarding/destination.ts` — `getDestinationForRoles` / `getDestinationForRole`; consumer with wholesale choice can route to `/wholesale`. No change needed for Phase 6.

---

## 6) Migration file numbering

- Last migration: **102** (`102_profiles_sync_preserve_user_fields.sql`).
- **Next migration**: **103** → `supabase/migrations/103_wholesale_applications.sql`.

---

## 7) Current /wholesale page

- **File**: `app/wholesale/page.tsx` exists.
- **Content**: Server component; gets user via `createSupabaseServerClient` + `getUser()`; `isLoggedIn = !!user?.id`. Renders title "Wholesale", subtitle, empty opportunities array (so "Wholesale listings are coming soon" + "Apply for access now"), and if !isLoggedIn shows "Sign in" + "Get Started" links. **Does not** check wholesale role or application status. Will be replaced/updated to implement the four states (A/B/C/D).

---

## 8) Approval status patterns

- **Driver approve**: `app/api/admin/drivers/applications/[id]/approve/route.ts` — requireAdminUsers; PATCH/state update; may update related tables.
- **Vendor applications**: RPC `admin_list_vendor_applications`; admin UI in `app/admin/vendors/page.tsx` (requireAdmin, then fetch).
- **Profile role update**: On wholesale approval we will **UPDATE profiles SET roles = array_append(roles, 'wholesale')** (or set roles to include 'wholesale') via admin client, matching how onboarding submit writes `roles`.

---

## 9) Profile structure (roles)

- **profiles.roles**: `TEXT[]`; added in `097_profiles_roles_array.sql`; default `ARRAY['consumer']`; backfilled from `role`. Constraint `profiles_roles_allowed` includes `'wholesale'` (100_profiles_roles_allow_wholesale.sql).
- **profiles.role**: Legacy single role; still used; `getRoles()` in lib/roles.ts merges both.
- **On approval**: Use admin client to update `profiles`: set `roles = array(SELECT unnest(roles) UNION SELECT 'wholesale')` or equivalent so `'wholesale'` is present and constraint satisfied. Exact column: `roles` (TEXT[]).

---

## Exact files to modify (confirmed paths)

| Path | Change |
|------|--------|
| `app/wholesale/page.tsx` | Replace with four-state logic: A not logged in, B logged in no wholesale role, C wholesale role pending/rejected/no app, D wholesale role + approved. Reuse Sign in / Get Started CTA from current page. |

---

## Exact files to create

| Path | Purpose |
|------|--------|
| `supabase/migrations/103_wholesale_applications.sql` | Table wholesale_applications, status/business_type checks, updated_at trigger, RLS (user insert/select own; admin select/update via admin_users), bucket wholesale-certificates + policies. |
| `app/api/wholesale/applications/upload-url/route.ts` | POST; auth required; validate filename, contentType; path wholesale-certificates/{userId}/{ts}-{filename}; createSignedUploadUrl; return { signedUrl, path }. |
| `app/api/wholesale/applications/submit/route.ts` | POST; auth; body business_name, business_type, company_size, products_sourcing, certificate_path; upsert logic (pending/rejected → update + clear review fields; approved → 400). |
| `app/api/wholesale/applications/me/route.ts` | GET; auth; return user's latest application or null. |
| `app/api/admin/wholesale/applications/route.ts` | GET; requireAdminUsers; list all applications ordered by submitted_at desc. |
| `app/api/admin/wholesale/applications/[id]/route.ts` | PATCH; requireAdminUsers; body status (approved/rejected), notes; update row + on approved update profile.roles to include 'wholesale'. |
| `app/wholesale/apply/page.tsx` | Form: business_name, business_type, company_size, products_sourcing, certificate upload (via upload-url then client upload); prefill from onboarding_answers; submit → POST submit; redirect /wholesale on success. |
| `app/dashboard/admin/wholesale/page.tsx` | Admin gate (requireAdmin or profile hasRole admin); list applications; filter by status; Approve/Reject + notes; call PATCH API. |

---

## DB objects to add

- **Table**: `public.wholesale_applications` (id, user_id, status, business_name, business_type, company_size, products_sourcing, certificate_path, submitted_at, reviewed_at, reviewed_by, notes, created_at, updated_at) with CHECKs as specified.
- **Trigger**: `update_wholesale_applications_updated_at` → `update_updated_at_column()`.
- **RLS**: Enable RLS; policy user insert own (user_id = auth.uid()); policy user select own; policy admin select all (EXISTS admin_users); policy admin update all (EXISTS admin_users). No broad user UPDATE.
- **Bucket**: `wholesale-certificates` (private). Policies: authenticated INSERT to path prefix own uid; users SELECT own path; admin SELECT all.

---

## Existing helpers to reuse

- **Auth**: `createSupabaseServerClient()`, `getSupabaseAdminClient()`.
- **Admin**: `requireAdminUsers(req)` for admin API routes; for admin page use `requireAdmin()` or fetch profile + `hasRole(profile, "admin")`.
- **Roles**: `hasRole(profile, "wholesale")`, `hasRole(profile, "admin")` from `@/lib/roles`.
- **Onboarding answers**: `lib/onboarding/answers.ts` — `getRoleAnswer(answers, "consumer", "wholesale_business_type")` etc. for prefill; profile has `onboarding_answers` (JSONB).
- **Storage**: Server client or admin `.storage.from('wholesale-certificates').createSignedUploadUrl(path)` for upload-url API (if available on server client with RLS); else admin client to create signed upload URL.

---

## Admin check method (confirmed)

- **API routes (admin)**: `requireAdminUsers(req)` from `@/lib/auth/requireAdminUsers`. Returns `{ user, isAdmin }`. If !user → 401; if !isAdmin → 403.
- **RLS**: `EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())`.

---

## Profile roles update on approval

- **Storage**: `profiles.roles` is TEXT[]; constraint allows 'wholesale'.
- **Method**: Admin client: `UPDATE profiles SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles || ARRAY['wholesale']) AS r), updated_at = now() WHERE id = :applicant_user_id`. Or: fetch current roles, add 'wholesale' if missing, update. Ensure no duplicate and constraint satisfied.

---

## Business type and options (from discovery)

- **questions.ts** CONSUMER_WHOLESALE_QUESTIONS_ONLY: business_type values `hotel`, `apartment`, `retail`, `restaurant`, `distributor`, `other`. DB constraint will use `apartment_multifamily`, `retail_store` etc. as in spec; mapping in apply form: apartment → apartment_multifamily, retail → retail_store. Company size options: na, 1-5, 6-25, 26-100, 100+.

---

## Sign in / Get Started CTA

- **Current wholesale page**: `<Link href="/login">Sign in</Link>`, `<Link href="/get-started">Get Started</Link>` with classes `btn-primary` / `btn-secondary`. Reuse this pattern for State A.

---

## Redirect for unauthenticated apply

- **Repo**: `app/onboarding/page.tsx` uses `redirect(\`/signup?redirect=...\`)` for no user. For /wholesale/apply, redirect to `/get-started` or `/login?next=/wholesale/apply` (per spec "get-started or welcome"; `app/page.tsx` uses `/welcome` and `/get-started`). Use **redirect to `/get-started`** with optional next param if needed.

---

End of Discovery Summary. Implementation to follow in phases 1–6.
