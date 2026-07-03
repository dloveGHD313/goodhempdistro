/**
 * Phase 3B: Public shop — getCategoriesCoaRequirementMap and COA filtering behavior.
 */
import { describe, expect, it, vi } from "vitest";
import { getCategoriesCoaRequirementMap, requiresCOA } from "@/lib/compliance";

describe("Phase 3B: getCategoriesCoaRequirementMap", () => {
  it("returns empty object for empty categoryIds", async () => {
    const supabase = vi.fn();
    const result = await getCategoriesCoaRequirementMap(supabase, []);
    expect(result).toEqual({});
  });

  it("returns empty object for no valid category ids", async () => {
    const supabase = vi.fn();
    const result = await getCategoriesCoaRequirementMap(supabase, ["", "  ", null as unknown as string]);
    expect(result).toEqual({});
  });

  it("returns map with category COA requirement when supabase returns categories", async () => {
    const categoriesData = [
      { id: "cat-apparel", name: "Apparel", slug: "apparel", parent_id: null, requires_coa: false },
      { id: "cat-cbd", name: "CBD Tinctures", slug: "cbd-tinctures", parent_id: null, requires_coa: true },
    ];
    const inMock = vi.fn().mockResolvedValue({ data: categoriesData });
    const selectMock = vi.fn().mockReturnValue({ in: inMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    const supabase = { from: fromMock };

    const result = await getCategoriesCoaRequirementMap(supabase as never, ["cat-apparel", "cat-cbd"]);

    // GATE-03 SSOT: requires_coa field is authoritative
    expect(requiresCOA({ slug: "apparel", name: "Apparel", requires_coa: false })).toBe(false);
    expect(requiresCOA({ slug: "cbd-tinctures", name: "CBD Tinctures", requires_coa: true })).toBe(true);
    expect(result["cat-apparel"]).toBe(false);
    expect(result["cat-cbd"]).toBe(true);
  });
});
