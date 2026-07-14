/**
 * Interest → category auto-match for the /products list.
 *
 * P0 (shop brief 2026-07-14): this match must run ONLY for interests the
 * user explicitly applied (the ?interests= URL param — set by sharing a
 * link or clicking "Use My Interests"). It previously also ran on saved
 * profile interests, silently pre-filtering the whole catalog: a consumer
 * with shopping_interests=["Wellness",…] never saw Clothing (the GHD Tee)
 * on /products at all. Saved profile interests may power the button, but
 * never an implicit filter.
 */

export type CategoryLike = { id: string; name: string };

/**
 * First category whose name contains any of the given interests
 * (case-insensitive), or null. Pure — unit-tested.
 */
export function matchCategoryForInterests(
  categories: CategoryLike[],
  explicitInterests: string[]
): CategoryLike | null {
  const normalized = explicitInterests
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (normalized.length === 0) return null;
  return (
    categories.find((category) =>
      normalized.some((tag) => category.name.toLowerCase().includes(tag))
    ) ?? null
  );
}
