# QA — Commerce Orders (Phase 2)

Orders foundation: migration, RLS, Stripe create-session + webhook, /account/orders, /vendors/orders.

## Schema (migration 067)

- **orders:** id, user_id, status, total_cents, currency (default usd), checkout_session_id, payment_intent_id, paid_at, created_at, updated_at. RLS: buyer read own, vendor read own vendor orders, admin read all; buyer can insert own.
- **order_items:** id, order_id, item_type (product|service|event_ticket|vendor_slot), item_id, vendor_user_id, quantity, unit_price_cents, line_total_cents, fulfilled_at, product_id (nullable). RLS: buyer read own order items, vendor read own vendor order items, admin read all; buyer can insert for own order.

## Stripe flow

1. **Create session:** POST /api/checkout/create-session with product_id, quantity. Uses getSession(). Creates pending order + order_items (item_type=product, item_id, vendor_user_id, line_total_cents). Creates Stripe checkout session; stores session id on order. Returns session URL.
2. **Webhook:** checkout.session.completed with order_id in metadata → update order status=paid, payment_intent_id, paid_at. payment_intent.succeeded → same update by payment_intent_id.

## UI

- **/account/orders:** Buyer’s orders (getSession, list by user_id).
- **/vendors/orders:** Vendor’s orders (getSession, list by vendor_id from vendors.owner_user_id).
- **/orders:** Same as account orders (getSession); link from account Quick Actions “My Orders” to /account/orders.

## Manual verification

1. Log in as consumer → create checkout for a product → pay (test mode) → confirm order appears on /account/orders and status paid.
2. Log in as vendor → open /vendors/orders → confirm orders for that vendor appear.
3. Log in as admin → confirm all orders visible (admin read-all policy).
4. Unauthenticated GET /api/checkout/create-session (or POST without session) → 401.

## Build

After Phase 2: `npm run build` must pass.
