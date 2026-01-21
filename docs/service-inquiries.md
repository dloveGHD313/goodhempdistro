# Service Inquiries Documentation

## Overview

The service inquiries system allows customers to submit inquiries about vendor services through the platform, keeping all communication internal and protecting vendor contact information.

## Database Schema

### Migration: `017_service_inquiries.sql`

This migration creates the `service_inquiries` table with the following structure:

```sql
CREATE TABLE service_inquiries (
  id UUID PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES services(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  requester_name TEXT,
  requester_email TEXT NOT NULL,
  requester_phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'closed')),
  vendor_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Key Fields

- `service_id`: Links to the service being inquired about
- `vendor_id`: Links to the vendor offering the service (for vendor inbox)
- `owner_user_id`: Vendor owner user ID for RLS enforcement
- `requester_*`: Contact information from the person submitting the inquiry
- `message`: Required message from the requester
- `status`: Workflow status ('new', 'replied', 'closed')
- `vendor_note`: Internal note visible only to the vendor (not to requester)

## RLS Policies

### Public (Insert Only)
- **Policy**: `Service inquiries: public can create for approved active services`
- **Access**: Anyone can create an inquiry, but ONLY if the target service is `approved` AND `active=true`
- **Security**: Prevents inquiries for services that are not live

### Vendor (Read & Update)
- **Policy**: `Service inquiries: vendor can read own`
- **Access**: Vendors can read inquiries where `owner_user_id = auth.uid()`
- **Policy**: `Service inquiries: vendor can update status and notes`
- **Access**: Vendors can update `status` and `vendor_note` only
- **Restriction**: Cannot modify requester fields (`requester_name`, `requester_email`, `requester_phone`, `message`)

### Admin (Full Access)
- **Policy**: `Service inquiries: admin can manage all`
- **Access**: Admins can read and update all inquiries

## API Routes

### POST `/api/services/[id]/inquire`

Public endpoint (authenticated or anonymous) to submit a service inquiry.

**Request Body:**
```json
{
  "requester_name": "John Doe",
  "requester_email": "john@example.com",
  "requester_phone": "(555) 123-4567",
  "message": "I'm interested in your consulting services..."
}
```

**Validation:**
- `requester_email`: Required, must be valid email format
- `message`: Required, max 5000 characters
- `requester_name`, `requester_phone`: Optional

**Security:**
- Service must be `approved` AND `active=true`
- `vendor_id` and `owner_user_id` are derived from the service (NOT accepted from client)
- Basic rate limiting: 30 seconds per email per service

**Response:**
```json
{
  "ok": true,
  "message": "Your inquiry has been sent successfully"
}
```

### PUT `/api/vendors/inquiries/[id]`

Vendor-only endpoint to update inquiry status and add vendor notes.

**Request Body:**
```json
{
  "status": "replied",
  "vendor_note": "Called customer, waiting for response"
}
```

**Validation:**
- `status`: Must be 'new', 'replied', or 'closed'
- `vendor_note`: Optional text

**Security:**
- Vendor can only update inquiries where `owner_user_id = auth.uid()`
- RLS enforces that only `status` and `vendor_note` can be changed

## User Interfaces

### Public Service Detail Page (`/services/[slug]`)

- Displays service information
- Shows "Request Service" form
- Form fields: name (optional), email (required), phone (optional), message (required)
- On submit: calls `/api/services/[id]/inquire`
- Shows success message after submission
- Rate limiting prevents spam (30s per email per service)

### Vendor Inquiries Page (`/vendors/services/inquiries`)

- Lists all inquiries for the logged-in vendor
- Filters by status (all, new, replied, closed)
- Shows summary cards with counts
- For each inquiry:
  - Service name
  - Requester contact info (name, email, phone)
  - Message
  - Created date
  - Current status
  - Vendor note (if any)
- Vendor can:
  - Update status (new → replied → closed)
  - Add/edit internal vendor note
  - Cannot modify requester information

### Admin Inquiries Page (`/admin/inquiries`)

- Lists all inquiries across all vendors
- Search by email, name, service, or vendor
- Filter by status
- Shows:
  - Requester information
  - Service details
  - Vendor information
  - Message
  - Status and notes
  - Timestamps

## Navigation

### Admin Nav
- Desktop dropdown: "💬 Service Inquiries" → `/admin/inquiries`
- Mobile drawer: "💬 Service Inquiries" → `/admin/inquiries`

### Vendor Nav
- Access via direct URL: `/vendors/services/inquiries`
- Can also be accessed from vendor dashboard/service management pages

## Migration Instructions

1. **Run Migration**
   ```sql
   -- In Supabase Dashboard → SQL Editor
   -- Copy and paste contents of supabase/migrations/017_service_inquiries.sql
   -- Execute
   ```

2. **Verify Table Creation**
   ```sql
   SELECT table_name, column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'service_inquiries'
   ORDER BY ordinal_position;
   ```

3. **Verify RLS Policies**
   ```sql
   SELECT tablename, policyname, cmd, qual
   FROM pg_policies 
   WHERE tablename = 'service_inquiries'
   ORDER BY policyname;
   ```

4. **Verify Indexes**
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'service_inquiries';
   ```

## Verification Queries

### Check Inquiry Counts
```sql
SELECT status, COUNT(*) as count
FROM service_inquiries
GROUP BY status
ORDER BY status;
```

### Check Recent Inquiries
```sql
SELECT 
  si.id,
  si.requester_email,
  si.status,
  s.title as service_name,
  v.business_name as vendor_name,
  si.created_at
FROM service_inquiries si
JOIN services s ON s.id = si.service_id
JOIN vendors v ON v.id = si.vendor_id
ORDER BY si.created_at DESC
LIMIT 10;
```

### Verify RLS is Working
```sql
-- As an authenticated user (not vendor), try to select:
-- Should return 0 rows (unless user created the inquiry)
SELECT * FROM service_inquiries;

-- As a vendor, should only see their own inquiries
SELECT COUNT(*) FROM service_inquiries;
```

## Manual Test Checklist

### Public Inquiry Submission
- [ ] Visit `/services` and select an approved service
- [ ] Fill out "Request Service" form with valid email and message
- [ ] Submit form → See success message
- [ ] Verify inquiry appears in vendor inbox

### Rate Limiting
- [ ] Submit inquiry with same email to same service
- [ ] Immediately try to submit again → Should see rate limit error
- [ ] Wait 30 seconds → Should be able to submit again

### Service Validation
- [ ] Try to submit inquiry to a draft service → Should fail (service not found)
- [ ] Try to submit inquiry to a rejected service → Should fail
- [ ] Only approved + active services accept inquiries

### Vendor Inbox
- [ ] Login as vendor → Navigate to `/vendors/services/inquiries`
- [ ] See all inquiries for your services
- [ ] Filter by status (new, replied, closed)
- [ ] Click "Update Status / Add Note"
- [ ] Change status to "replied"
- [ ] Add vendor note
- [ ] Save changes → See updated inquiry

### Vendor Restrictions
- [ ] As vendor, verify you cannot see other vendors' inquiries
- [ ] Verify you can only update status and vendor_note (not requester fields)

### Admin View
- [ ] Login as admin → Navigate to `/admin/inquiries`
- [ ] See all inquiries from all vendors
- [ ] Search by email → Filter results
- [ ] Search by service name → Filter results
- [ ] Search by vendor name → Filter results
- [ ] Filter by status → See filtered list

### Service Detail Page
- [ ] Visit `/services/[invalid-slug]` → See "Service Not Available" message
- [ ] Visit `/services/[draft-service-slug]` → See "Service Not Available" (not approved/active)
- [ ] Verify no blank pages are shown

### URL Routing
- [ ] Verify service detail links use format `/services/{slug}` not `/services/services/{slug}`
- [ ] Click service from `/services` listing → Lands on correct detail page

## Security Considerations

1. **No Vendor Contact Exposure**
   - Vendors' direct contact information is never exposed to public
   - All communication flows through the platform

2. **RLS Enforcement**
   - Public can only create inquiries for approved+active services
   - Vendors can only see their own inquiries
   - Vendors cannot modify requester information

3. **Server-Side Validation**
   - `vendor_id` and `owner_user_id` are derived from service, never from client
   - Email format validation
   - Message length limits
   - Rate limiting prevents spam

4. **Data Integrity**
   - Foreign key constraints ensure inquiries link to valid services/vendors
   - Cascade deletes clean up inquiries if service/vendor is deleted

## Troubleshooting

### Inquiry Not Appearing in Vendor Inbox
1. Check service is approved and active
2. Verify `vendor_id` and `owner_user_id` are correctly set on inquiry
3. Check RLS policies are correctly applied
4. Verify vendor is logged in with correct user account

### Rate Limiting Too Aggressive
- Current limit: 30 seconds per email per service
- Can be adjusted in `/api/services/[id]/inquire` route
- Consider using Redis for more sophisticated rate limiting in production

### RLS Policy Errors
- Verify policies exist: `SELECT * FROM pg_policies WHERE tablename = 'service_inquiries'`
- Check policy conditions are correct
- Ensure `owner_user_id` is correctly set on service inquiries
