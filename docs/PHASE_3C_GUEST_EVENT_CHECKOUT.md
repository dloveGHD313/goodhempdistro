# Phase 3C: Guest Checkout for Event Tickets — Discovery Summary

## 1. How events are stored and rendered

- **Source:** Supabase table `events` (migration `006_events.sql`). Columns: id (UUID), vendor_id, title, description, location, start_time, end_time, capacity, tickets_sold, status (draft | published | cancelled), created_at, updated_at.
- **List page:** `/events` — server component in `app/events/page.tsx` calls `getPublishedEvents()` which queries `events` with status in (`approved`, `published`), `start_time >= now`, ordered by start_time. Renders `EventsList` (client) with initial events. Layout has no auth redirect (public).
- **Detail page:** `/events/[id]` exists — client component in `app/events/[id]/page.tsx` fetches event via `GET /api/events/[id]` (public). API returns event plus `event_ticket_types` from `event_ticket_types` table. Event id format: UUID.
- **Ticket types:** Table `event_ticket_types` (event_id, name, price_cents, quantity, sold). Detail page shows quantity selectors per ticket type and "Buy Tickets" calling `POST /api/events/checkout` with `event_id` and `tickets: [{ ticket_type_id, quantity }]`.

## 2. Payment / checkout infrastructure

- **Stripe:** Used across the app. `lib/stripe.ts` exports `stripe` (proxy to getStripeServer()), `getSiteUrl()`, `getCheckoutSession(sessionId)`. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`.
- **Product checkout:** `POST /api/checkout/create-session` — requires auth (401 if no user), creates Stripe Checkout session for product purchase, uses orders/order_items tables.
- **Event checkout:** `POST /api/events/checkout` — currently **requires auth** (returns 401 if no user). Creates a row in `event_orders` with `user_id`, then `event_order_items`, then Stripe Checkout session (mode: payment, line_items from ticket types). Success URL: `/events/success?session_id={CHECKOUT_SESSION_ID}`. Cancel URL: `/orders/cancel`. Returns `{ session_id, url }`; client redirects to `url`.
- **Webhook:** `app/api/webhooks/stripe/route.ts` handles `checkout.session.completed`. If `metadata.order_type === "event"` and `metadata.order_id`, calls `handleEventOrderCompleted(session, orderId)` which updates event_orders status to paid, increments tickets_sold and ticket_type.sold via admin client.

## 3. Orders / payments DB and RLS

- **event_orders** (006_events.sql): id, **user_id UUID NOT NULL REFERENCES profiles(id)**, event_id, total_cents, stripe_session_id, status (pending | paid | cancelled), created_at, updated_at. RLS: user can read own (user_id = auth.uid()), vendor can read for own events, admin can read all.
- **event_order_items:** event_order_id, ticket_type_id, quantity, price_cents. RLS ties to parent order visibility.
- **Product orders:** Separate `orders` / `order_items` (067, etc.); not used for events.

## 4. Age gate / 21+ flow

- **AgeGate component** (`components/AgeGate.tsx`): Client-side; sets cookie `ghd_age_verified` and localStorage `ghd_age_verified_ts` (30-day), then optionally calls `POST /api/age/verify`. Used for site entry; does not require an account (cookie works for logged-out).
- **POST /api/age/verify:** If there is a logged-in user, updates `profiles.age_verified = true`; otherwise returns 200 with `message: "no user"`. So logged-out users can pass the gate (cookie only); the API only persists for logged-in.
- **Event checkout:** Currently no explicit 21+ check in the event checkout route. For Phase 3C we will require an explicit 21+ confirmation (e.g. body param or cookie) for event ticket purchase, guest or not.

## 5. What Phase 3C will reuse

- Events tables and APIs: `events`, `event_ticket_types`, `event_orders`, `event_order_items`.
- `POST /api/events/checkout` — extend to allow unauthenticated requests when `purchaser_email` and `age_confirmed_21` are provided; create event_orders with `user_id` NULL and `purchaser_email` set.
- Stripe Checkout session creation (existing pattern); success/cancel redirects; webhook `handleEventOrderCompleted` (no change; works off order_id).
- `GET /api/events/[id]` (public), `/events`, `/events/[id]` (public).
- `/events/success` and `POST /api/events/confirm` — extend confirm to return receipt fields (event title, quantity, email) for success page; keep public (no auth).

## 6. Schema change (implemented)

- **event_orders:** Migration `095_event_orders_guest_checkout.sql` adds `purchaser_email TEXT`, makes `user_id` nullable, adds CHECK (user_id IS NOT NULL OR (purchaser_email IS NOT NULL AND trim(purchaser_email) <> '')).

---

## Implementation summary (Phase 3C)

- **POST /api/events/checkout:** No longer requires auth. Accepts optional `purchaser_email` and required `age_confirmed_21` (for all purchasers). When guest: `purchaser_email` required; when logged in: `user_id` stored, optional email. Creates event_orders with `user_id` (or null) and `purchaser_email` (for guest). Stripe session uses `customer_email` for guest. Cancel URL set to `/events/checkout/cancel`.
- **Event detail page (/events/[id]):** Added 21+ confirmation checkbox (required for paid events) and guest email input when not logged in. Checkout payload includes `age_confirmed_21: true` and `purchaser_email` when guest.
- **POST /api/events/confirm:** Returns `eventTitle`, `totalQuantity`, `purchaserEmail` for receipt display (public, no auth).
- **/events/success:** Displays event name, quantity, email, order id. Links: Browse More Events, Home.
- **/events/checkout/cancel:** New public page; cancel URL from Stripe points here.
- **21+ compliance:** Explicit checkbox "I confirm I am 21 years of age or older" required before creating checkout session; enforced in API for both guest and logged-in. Applies to event ticket checkout only.
