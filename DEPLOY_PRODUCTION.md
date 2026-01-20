# Production Deployment Guide

## Supabase Configuration

### Supabase Auth URL Configuration

In Supabase Dashboard → Authentication → URL Configuration:

1. **Site URL:**
   ```
   https://www.goodhempdistro.com
   ```

2. **Redirect URLs (add both):**
   ```
   https://www.goodhempdistro.com/*
   https://goodhempdistro.com/*
   ```

3. **Password Reset Redirect:**
   - Password reset emails will redirect to: `https://www.goodhempdistro.com/reset-password`
   - This is configured in code (see `app/login/LoginForm.tsx`)
   - Ensure this URL is included in the Redirect URLs list above

This ensures password reset links work for both www and non-www domains.

### Email Confirmation Setup

1. **Navigate to Supabase Dashboard**
   - Go to Authentication > Providers > Email
   - Configure email confirmation settings

2. **Enable Email Confirmation (Recommended for Production)**
   - Toggle "Confirm email" to ON
   - Set redirect URL: `https://yourdomain.com/dashboard`
   - Configure SMTP settings for production emails:
     - Go to Settings > Auth > SMTP Settings
     - Add your SMTP provider credentials (SendGrid, AWS SES, etc.)
     - Test email delivery

3. **Disable Email Confirmation (Development/Testing)**
   - Toggle "Confirm email" to OFF
   - Users will be logged in immediately after signup

### Manual User Confirmation (Fallback)

If a user doesn't receive their confirmation email:

1. Go to Supabase Dashboard > Authentication > Users
2. Find the user by email
3. Click on the user
4. Click "Confirm email" button
5. User can now log in

### Vendor Approval Flow

1. **Run Migration 007**
   - Execute `supabase/migrations/007_vendor_approval.sql` in Supabase SQL Editor
   - This creates the `vendor_applications` table

2. **Admin Vendor Approval**
   - Admins can access `/admin/vendors` to approve/reject vendor applications
   - When approved:
     - Creates `vendors` table record with status "active"
     - Updates `profiles.role` to "vendor"
     - User can now access vendor pages

3. **Vendor Registration Flow**
   - Users submit vendor application at `/vendor-registration`
   - Application is created with status "pending"
   - Admin reviews and approves/rejects
   - User receives notification (via email or dashboard message)

## Environment Variables

Ensure these are set in production:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (server-only)
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
DEBUG_KEY=your_debug_key (optional, for production debugging)
```

### How to Verify Deployment

1. **Check Debug Endpoint**
   - Visit `/api/_debug/vendors-create` in your browser
   - Verify response shows:
     - `build_marker`: "vendors-create-debug-v3"
     - `has_DEBUG_KEY_env`: true (if DEBUG_KEY is set in Vercel)
     - `deployed_at`: ISO timestamp of when endpoint was accessed

2. **Enable Debug Mode**
   - Visit `/vendor-registration?debug=1` (note the `?debug=1` query parameter)
   - Check the visible DEBUG PANEL on the page to verify setup
   - Open DevTools Console (F12)
   - Run with straight quotes: `localStorage.setItem("DEBUG_KEY", "your-key-value")`
   - Replace `your-key-value` with the exact same value you set in Vercel
   - Refresh the page to see the DEBUG PANEL update

3. **Verify Request Headers**
   - Open DevTools > Network tab
   - Submit the vendor registration form
   - Find the `create` request (POST to `/api/vendors/create`)
   - Click on it and go to "Headers" tab
   - Under "Request Headers", verify `x-debug-key` is present
   - The value should match your `DEBUG_KEY` (first 6 chars shown in DEBUG PANEL)

4. **Verify Response Headers and Body**
   - In the Network tab, click on the `create` request
   - Under "Response Headers", verify:
     - `X-Build-Marker`: "vendors-create-debug-v3"
     - `X-Request-Id`: UUID string
     - `Cache-Control`: "no-store"
   - Go to "Response" or "Preview" tab
   - The JSON response will include:
     - `build_marker`: "vendors-create-debug-v3"
     - `request_id`: Unique UUID for this request (use to find logs in Vercel)
     - `debug_status`: Object showing if debug is enabled and why (if disabled)
     - `debug`: Object with detailed diagnostics (only if debug enabled):
       - `has_user`: Whether user was authenticated
       - `user_id`: Authenticated user ID (if available)
       - `auth_error`: Authentication error details (if any)
       - `cookie_present`: Whether Supabase auth cookies were detected
       - `supabase_error`: Full Supabase error (code, message, details, hint) if insert fails
       - `server_timestamp`: When the error occurred

5. **Find Logs in Vercel Using request_id**
   - Go to Vercel Dashboard > Your Project > Functions/Logs
   - Search for the `request_id` from the response
   - All server-side logs include the `request_id` for easy tracking

**Important Notes:**
- localStorage is origin-specific. If you set DEBUG_KEY on `www.yourdomain.com` but visit `yourdomain.com` (or vice versa), they are different origins. Always set the key on the exact origin you're using.
- The DEBUG PANEL shows the origin, whether debug=1 is in the URL, whether DEBUG_KEY exists in localStorage, whether the header is being sent, and the response headers (marker/id) if available.

### Production Debug Mode

To enable production debugging for vendor application creation:

1. **Set DEBUG_KEY in Vercel Environment Variables**
   - Go to Vercel Dashboard > Your Project > Settings > Environment Variables
   - Add `DEBUG_KEY` with a secure random value (e.g., generate with `openssl rand -hex 32`)
   - Apply to Production environment
   - Deploy the changes

2. **Verify Debug Endpoint Shows DEBUG_KEY is Set**
   - Visit `/api/_debug/vendors-create`
   - Confirm `has_DEBUG_KEY_env: true` in the response

3. **Enable Debug Mode in Browser**
   - Visit `/vendor-registration?debug=1` (note the `?debug=1` query parameter)
   - **Important:** Check the visible DEBUG PANEL on the page to verify setup
   - Open DevTools Console (F12)
   - Run with straight quotes: `localStorage.setItem("DEBUG_KEY", "your-debug-key-value")`
   - Replace `your-debug-key-value` with the exact same value you set in Vercel
   - Refresh the page to see the DEBUG PANEL update with "DEBUG_KEY in localStorage: ✅ YES"

4. **Submit Form and Verify Response**
   - Fill out and submit the vendor registration form
   - Check the DEBUG PANEL shows:
     - Response X-Build-Marker: "vendors-create-debug-v3"
     - Response X-Request-Id: UUID string
   - Open Network tab > click on `create` request
   - Verify Response Headers include X-Build-Marker and X-Request-Id
   - Verify Response Body includes build_marker, request_id, debug_status, and debug object (if enabled)

**Troubleshooting:**

- **Origin Mismatch Warning:** localStorage is origin-specific. If you set DEBUG_KEY on `www.yourdomain.com` but visit `yourdomain.com` (or vice versa), they are different origins. Always set the key on the exact origin you're using.
- **Debug Status Shows "missing_header_key":** Check Network tab to verify `x-debug-key` header is being sent. If not, ensure you ran the localStorage command and refreshed the page.
- **Debug Status Shows "header_key_mismatch":** The value in localStorage doesn't match `DEBUG_KEY` in Vercel. Verify both values are identical.
- **Debug Status Shows "missing_env_key":** `DEBUG_KEY` is not set in Vercel environment variables or deployment hasn't picked it up yet.

**Security Note:** Debug mode only activates when ALL of these are true:
- URL contains `?debug=1`
- `DEBUG_KEY` environment variable is set in Vercel
- Request header `x-debug-key` matches `DEBUG_KEY` value exactly

Even when debug is OFF, responses include `build_marker`, `request_id`, and `debug_status` to help diagnose configuration issues.

## Database Migrations

Run migrations in order:
1. `001_marketplace_core.sql`
2. `002_categories.sql`
3. `003_categories_group.sql`
4. `005_compliance_logistics.sql`
5. `006_events.sql`
6. `007_vendor_approval.sql` (NEW)

## Testing Checklist

- [ ] User signup with email confirmation works
- [ ] Vendor registration creates application (not vendor directly)
- [ ] Admin can approve vendor applications
- [ ] Approved vendors can access `/vendors/events/new`
- [ ] Non-vendors see friendly message (not blank page)
- [ ] Pending vendors see pending status message
- [ ] Suspended vendors see suspended message
