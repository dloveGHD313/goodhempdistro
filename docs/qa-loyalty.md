# QA — Loyalty (Phase 6)

Points awarded on paid orders; applies to products/services/events. Existing consumer_loyalty + consumer_loyalty_events; webhook awards via awardPurchasePointsForOrder.

## UI

- **/account/loyalty:** Shows points balance, lifetime earned, recent loyalty events (from GET /api/consumer/loyalty). Link from account.

## Verification

1. Log in as consumer with subscription; open /account/loyalty; confirm balance and events.
2. After a paid order, confirm points appear (webhook awards purchase_points).
