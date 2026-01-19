# Production Deployment Guide

## Supabase Configuration

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
```

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
