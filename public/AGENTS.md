# Good Hemp Distro – Agent Rules (Codex)

## Always do these steps
1) Before changing anything: summarize current state + list files you’ll touch.
2) Make small, focused commits (one goal per commit).
3) After each goal: run
   - npm run test -- --run
   - npm run build
4) Keep navigation + routing working on mobile + desktop.
5) Never leave placeholder debug text visible on pages.

## Brand + UI
- Dark navy background, “glass” cards, lime/green accents, orange CTA buttons.
- Logo must load in production from a valid /public path.
- Use CSS variables in app/globals.css for colors; avoid hardcoded random Tailwind colors.

## Age Gate
- Must show 21+ gate for non-verified users.
- Users can browse home + feed but must create an account to fully use features.

## Pages / Routes
Required nav routes:
- /newsfeed, /groups, /forums, /products, /blog, /wholesale, /events, /vendor-registration, /affiliate, /account

If a route is not built yet, create a clean placeholder page (not broken).

## Vendor subscriptions (monthly)
- BASIC: $50, 7% commission, limited products, limited features, can post events.
- PRO: $125, 4% commission, up to 100 products, unlimited events.
- ELITE: $250, unlimited products, featured vendor, wholesale access, event discounts, discounted COAs.

Must be editable later via an admin portal.

## Consumer subscriptions (monthly)
- Starter: $5.99
- Plus: $12.99
- VIP: $23.99
Each tier increases loyalty points and benefits; VIP gets best perks.

## Affiliate / referrals
Affiliate page for subscribed consumers + vendors:
- Referral payouts: $5, $15, $25 depending on package.
- Track referral link usage + payouts.

## Verification
- Any DB/schema changes must be reflected in Supabase SQL scripts.
- Keep environment variables documented in .env.example if needed.
