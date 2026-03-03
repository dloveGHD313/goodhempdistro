# Entry Rule Gap

**Vision vs current behavior at /products**

---

## CEO Vision Rule

> "No interaction without an account — users can watch animation, then must sign up."

## Current behavior

`/products` is publicly accessible (no auth gate in middleware or page component). A logged-out visitor can:
- View the product listing page
- Use the search input
- See product cards (if any exist)
- Click through to individual products (some are gated, some are not)

## Gap

| Surface | Vision | Current | Aligned? |
|---|---|---|---|
| `/products` page load | Require account | Publicly accessible | ❌ Gap |
| Product search/filter | Require account | Publicly accessible | ❌ Gap |
| Product detail (ungated) | Require account | Publicly accessible | ❌ Gap |
| Product detail (gated/recreational) | Require account + verification | Requires verification | ✅ Partially |
| Add to cart / purchase | Require account | Requires account (checkout) | ✅ |

## Decision: Do NOT change global gating in this PR

This PR fixes only the catalog empty-state UX. Implementing the full entry gate at `/products` would require:
1. Middleware update to add `/products` to the protected route list
2. Design decision on whether to show a teaser/preview before gating
3. CEO sign-off on gating the marketplace to logged-out users

**Risk:** Gating `/products` could hurt organic SEO discoverability of the marketplace. This is a CEO-level product decision.

## Next steps (requires CEO decision before implementing)

- [ ] Confirm: should `/products` be fully gated (redirect to /signup) for logged-out?
- [ ] Confirm: should a logged-out user see a blurred/teased product list with signup prompt?
- [ ] If gating approved: add `/products` + `/products/` to `isProtectedPage` in `middleware.ts`
- [ ] If teaser model: implement a `<MarketplaceGate>` overlay component over the product grid
