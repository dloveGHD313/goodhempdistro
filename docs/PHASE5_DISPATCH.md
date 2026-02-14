# Phase 5A Dispatch (Email-first)

## Environment variables
- `RESEND_API_KEY`: API key for sending dispatch offer emails.
- `EMAIL_FROM`: verified sender identity used for dispatch emails.
- `NEXT_PUBLIC_SITE_URL`: absolute base URL used in secure accept/decline links.

## Manual verification checklist
1. Login as an approved driver and open `/driver/dashboard`.
2. Set **Online** and click **Update location** to store current coordinates.
3. Create a delivery request with pickup coordinates (`pickup_lat`, `pickup_lng`) near the driver.
4. Confirm dispatch email arrives with accept/decline links.
5. Click **Accept** link and verify delivery becomes assigned to that driver.
6. Open a second driver offer link for same delivery and verify it reports already taken.
