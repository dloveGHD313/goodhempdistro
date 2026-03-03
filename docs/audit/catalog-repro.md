# Catalog Repro Evidence

**Date:** 2026-03-02
**Branch:** fix/catalog-readiness
**URL:** https://www.goodhempdistro.com/products

---

## Observed behavior (all roles, logged out)

**Page loads successfully (200).** The product hero, metrics, search, and category filter all render. After client hydration, the product grid shows:

```
No products match your filters.
Try adjusting the search or category.
```

Additional copy visible in audit capture:
```
More products coming soon. Check back regularly for new additions.
```

No product cards are rendered. The grid area is replaced by the empty state.

---

## Network trace (from live-site audit, 2026-03-02)

- **Request:** `GET https://www.goodhempdistro.com/products` → 200 OK
- **Server-side query:** Supabase `products` table, filters: `status=eq.approved`, `active=eq.true`, `is_gated=eq.false`
- **Server response payload:** 0 products returned (clean-text.txt shows no product card content)
- **Client-side filter:** `ProductsList` receives `initialProducts=[]`, so `filteredProducts=[]` after useMemo

---

## Role comparison

| Role | Sees products |
|---|---|
| Logged out | 0 — empty state |
| Logged in (consumer) | 0 — same empty state |
| Logged in (admin) | 0 — same empty state (no admin-bypass in this component) |

Admin users do not get a special view at `/products` — they use `/admin/products` for their review queue.

---

## Code path

```
app/products/page.tsx
  └─ getProducts(vendorId=null, includeGated=false, publicShopOnly=!user)
       └─ supabase.from("products")
            .eq("status", "approved")
            .eq("active", true)
            .eq("is_gated", false)
       └─ further filter: only products from active vendors
       └─ further filter (logged out): COA-not-required only
  └─ ProductsList({ initialProducts: [] })
       └─ filteredProducts = [] (useMemo over empty array)
       └─ Shows: "No products match your filters."
```
