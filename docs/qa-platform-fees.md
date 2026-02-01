# QA — Platform Fees (Phase 3)

Platform commission (owner take-rate) per paid line item; fee depends on vendor tier/plan and item_type; persisted on order_items when order is paid.

## Schema (migration 068)

- **platform_fee_rules:** vendor_plan_type, item_type (product|service|event_ticket|vendor_slot), fee_bps (basis points, 100 = 1%), active. Unique (vendor_plan_type, item_type). Seeded: default/starter/mid/top × product/service/event_ticket/vendor_slot.
- **order_items:** platform_fee_cents, vendor_net_cents (set when order marked paid).

## Business rule

- Platform “commission” = owner revenue per paid line item.
- fee_bps from platform_fee_rules by (vendor_plan_type, item_type); vendor_plan_type from vendor’s tier/subscription_plan_key or "default".
- platform_fee_cents = floor(line_total_cents * fee_bps / 10000).
- vendor_net_cents = line_total_cents - platform_fee_cents.

## Webhook

- When order is marked paid (checkout.session.completed or payment_intent.succeeded): for each order_item, resolve vendor plan, get fee rule, compute platform_fee_cents and vendor_net_cents, update order_items (via applyPlatformFeesToOrder).

## Manual verification

1. Create and pay a product order (test mode).
2. In DB: order_items for that order have platform_fee_cents and vendor_net_cents set; platform_fee_cents + vendor_net_cents = line_total_cents (or line_total from quantity × unit_price).
3. Change vendor tier or seed rules; pay another order; confirm fees match rules.

## Build

After Phase 3: `npm run build` must pass.
