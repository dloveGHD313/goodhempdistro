import { describe, expect, it } from "vitest";
import { matchCategoryForInterests } from "@/lib/products/interestCategoryMatch";

/**
 * P0 regression contract (shop brief 2026-07-14): the /products category
 * auto-match runs only on EXPLICIT (?interests=) values. The production
 * bug: ghdconsumer's saved shopping_interests ["Wellness","Business
 * Supplies","Skincare"] silently pre-filtered the catalog to a Wellness
 * category, hiding the COA-exempt Clothing Tee from the list entirely.
 */

const CATEGORIES = [
  { id: "cat-clothing", name: "Clothing" },
  { id: "cat-wellness", name: "Personal Wellness" },
  { id: "cat-skincare", name: "CBD Skincare" },
];

describe("matchCategoryForInterests", () => {
  it("no explicit interests → no auto-filter (the P0 fix)", () => {
    // Saved profile interests are NOT passed here anymore — only URL ones.
    expect(matchCategoryForInterests(CATEGORIES, [])).toBeNull();
  });

  it("explicit interests match case-insensitively by name substring", () => {
    expect(matchCategoryForInterests(CATEGORIES, ["wellness"])?.id).toBe("cat-wellness");
    expect(matchCategoryForInterests(CATEGORIES, ["SKINCARE"])?.id).toBe("cat-skincare");
  });

  it("unmatched interests → null (list stays unfiltered)", () => {
    expect(matchCategoryForInterests(CATEGORIES, ["Business Supplies"])).toBeNull();
  });

  it("ignores blank/whitespace values", () => {
    expect(matchCategoryForInterests(CATEGORIES, ["", "   "])).toBeNull();
  });
});
