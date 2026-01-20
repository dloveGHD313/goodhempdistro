# Password Reset Flow Documentation

## Overview
The password reset flow allows users to reset their password via email link. This document covers configuration, implementation, and troubleshooting.

## Supabase Configuration

### 1. URL Configuration

**Supabase Dashboard → Authentication → URL Configuration:**

1. **Site URL:**
   ```
   https://www.goodhempdistro.com
   ```

2. **Redirect URLs (add all - REQUIRED):**
   ```
   https://www.goodhempdistro.com/reset-password
   https://goodhempdistro.com/reset-password
   http://localhost:3000/reset-password
   https://www.goodhempdistro.com/auth/callback
   http://localhost:3000/auth/callback
   ```

   **Important:** 
   - These URLs are REQUIRED for password reset to work
   - Use wildcard patterns if supported:
     ```
     https://www.goodhempdistro.com/*
     https://goodhempdistro.com/*
     http://localhost:3000/*
     ```
   - Even if Supabase redirects to Site URL root (`/`), the global recovery hash handler will forward to `/reset-password`

### 2. Email Templates

**Supabase Dashboard → Authentication → Email Templates → Reset Password:**

- Ensure the template uses `{{ .RedirectTo }}` if you want custom redirect URLs
- Default template should work, but verify the link format matches your redirect URLs

### 3. Email Provider Settings

- Configure SMTP settings for production emails
- Test email delivery in Supabase Dashboard

## Implementation Details

### Request Reset Flow

1. User clicks "Forgot password?" on `/login`
2. Enters email address
3. `LoginForm` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })`
4. Supabase sends email with reset link

**Redirect URL Logic:**
- Client-side: Uses `window.location.origin` (works on localhost and production)
- Falls back to `https://www.goodhempdistro.com` if `window` is undefined

### Reset Link Formats

Supabase supports two link formats:

#### A) PKCE Flow (Code-based)
```
https://www.goodhempdistro.com/auth/callback?code=...&type=recovery
```
- Handled by `/auth/callback` route
- Exchanges code for session server-side
- Redirects to `/reset-password`

#### B) Hash Token Flow (Legacy)
```
https://www.goodhempdistro.com/reset-password#access_token=...&refresh_token=...&type=recovery
```
- Handled directly by `/reset-password` client component
- Sets session from hash tokens

### Reset Password Page Flow

**Route:** `/reset-password`

1. **Server Component** (`app/reset-password/page.tsx`):
   - Gets user email if session exists (for resend functionality)
   - Renders `ResetPasswordClient`

2. **Client Component** (`app/reset-password/ResetPasswordClient.tsx`):
   - On mount, checks for:
     - `?code=...` (PKCE) → calls `exchangeCodeForSession(code)`
     - Hash with `access_token` + `refresh_token` + `type=recovery` → calls `setSession()`
     - Hash with `error_code=otp_expired` → shows expired message + resend form
   - When session established → shows password form
   - On submit → calls `updateUser({ password })`
   - On success → redirects to `/login?message=password_reset_success`

### Error Handling

**Expired/Invalid Links:**
- Detects `error_code=otp_expired` or `access_denied` in URL hash
- Shows friendly error message
- Displays "Resend Reset Link" form
- User can request new reset email

**Missing Session:**
- If no tokens found and no existing session
- Shows error + resend form

### Global Recovery Hash Handler

**Component:** `components/RecoveryHashRedirect.tsx`

- Renders in root layout (`app/layout.tsx`) - runs on EVERY page
- Detects hash containing:
  - `type=recovery` AND (`access_token` OR `error_code=otp_expired` OR `error=access_denied`)
- Immediately redirects to `/reset-password` with hash preserved
- Safety net for mis-redirects from Supabase (sometimes redirects to Site URL root instead of redirectTo)

**Why Global:**
- Supabase may redirect to Site URL root (`/`) instead of the specified `redirectTo`
- By placing handler in root layout, it catches recovery hashes on ANY route
- Ensures users always reach `/reset-password` regardless of where Supabase sends them

## Middleware Configuration

**File:** `middleware.ts`

- `/reset-password` is in `publicAuthRoutes` array
- Never redirects away from `/reset-password` (allows both authenticated and unauthenticated access)
- `/auth/callback` is also public (handles code exchange)

## Manual Testing Checklist

### Test 1: Request Reset on Production
- [ ] Navigate to `https://www.goodhempdistro.com/login`
- [ ] Click "Forgot password?"
- [ ] Enter valid email
- [ ] Click "Send Reset Link"
- [ ] Verify success message appears
- [ ] Check email inbox for reset link

### Test 2: Reset Link Opens Correct Page
- [ ] Click reset link in email
- [ ] Verify redirects to `https://www.goodhempdistro.com/reset-password` (not root or login)
- [ ] Verify password form appears (not error)
- [ ] Enter new password (8+ characters)
- [ ] Confirm password matches
- [ ] Click "Update Password"
- [ ] Verify success message
- [ ] Verify redirects to `/login?message=password_reset_success`
- [ ] Verify can login with new password

### Test 3: Expired Link Handling
- [ ] Use expired reset link (or wait for link to expire)
- [ ] Verify shows "Link expired or invalid" message
- [ ] Verify "Resend Reset Link" form appears
- [ ] Enter email and click "Resend Reset Link"
- [ ] Verify new email sent
- [ ] Use new link and verify it works

### Test 4: Logged-in User Can Access Reset
- [ ] Login as any user
- [ ] Navigate to `/reset-password` directly
- [ ] Verify page loads (not redirected away)
- [ ] If no recovery session, verify shows resend form
- [ ] Verify can request reset while logged in

### Test 5: Middleware Does Not Block
- [ ] While logged out, navigate to `/reset-password`
- [ ] Verify page loads (not redirected to login)
- [ ] While logged in, navigate to `/reset-password`
- [ ] Verify page loads (not redirected to dashboard)

### Test 6: Homepage Hash Redirect (Safety Net)
- [ ] Manually navigate to `/#access_token=...&type=recovery`
- [ ] Verify immediately redirects to `/reset-password#access_token=...&type=recovery`
- [ ] Verify reset form appears

### Test 7: Localhost Testing
- [ ] Run `npm run dev` on localhost:3000
- [ ] Request reset link
- [ ] Verify redirect URL in email is `http://localhost:3000/reset-password`
- [ ] Click link and verify works

## Common Issues & Fixes

### Issue: Reset link redirects to root with hash error

**Symptoms:**
- URL: `https://www.goodhempdistro.com/#error=access_denied&error_code=otp_expired`

**Causes:**
1. Redirect URL not in Supabase allowed list
2. Email template using wrong URL format
3. Supabase misconfiguration

**Fixes:**
1. Add `/reset-password` to Supabase Redirect URLs
2. Verify email template uses `{{ .RedirectTo }}`
3. Check Supabase Site URL matches production domain

**Safety Net:**
- Homepage hash handler will catch this and redirect to `/reset-password`

### Issue: Reset link redirects to /login

**Symptoms:**
- Clicking reset link goes to `/login` instead of `/reset-password`

**Causes:**
1. `/auth/callback` route redirecting incorrectly
2. Middleware blocking `/reset-password`

**Fixes:**
1. Verify `/auth/callback` redirects to `/reset-password` (not `/login`)
2. Verify middleware has `/reset-password` in `publicAuthRoutes`
3. Check middleware doesn't redirect authenticated users away from `/reset-password`

### Issue: "No active session found" error

**Symptoms:**
- Reset page shows error immediately

**Causes:**
1. Code/token exchange failed
2. Link expired
3. Wrong link format

**Fixes:**
1. Check server logs for exchange errors
2. Request new reset link
3. Verify link format matches expected (code or hash)

### Issue: Password update fails

**Symptoms:**
- Form submits but shows error

**Causes:**
1. Session expired during form fill
2. Password doesn't meet requirements
3. Network error

**Fixes:**
1. Check password length (8+ characters)
2. Verify passwords match
3. Check browser console for errors
4. Try again with new reset link if session expired

## Server Logs

Look for these log prefixes:
- `[login]` - Password reset request
- `[reset-password]` - Reset page operations
- `[auth/callback]` - Code exchange

## Security Notes

- Reset links expire after configured time (default: 1 hour)
- Tokens are never logged or exposed in UI
- Service role key is never used for reset flow (only for admin operations)
- RLS policies remain unchanged
