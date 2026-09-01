/**
 * Project submission → vendor matching (Build: contractor/developer lead-gen).
 *
 * Pure logic, no I/O — the API/server action fetches candidate vendors and
 * passes them in, so tests can pin the behavior without a database.
 *
 * v1 heuristic:
 *   - category match: overlap between the submission's requested categories
 *     and the vendor's categories/tags (case-insensitive substring both ways)
 *   - state match: vendor.state equals the project state, or the project
 *     state appears in vendor.service_areas
 * A vendor must have a category match to qualify; state match boosts rank.
 */

export const PROJECT_CATEGORY_OPTIONS = [
  { id: "hempcrete", label: "Hempcrete / hemp-lime installation" },
  { id: "hurd", label: "Hemp hurd (aggregate)" },
  { id: "binder", label: "Lime binder" },
  { id: "insulation", label: "Hemp insulation (batts / blown-in)" },
  { id: "blocks-panels", label: "Hemp blocks / prefab panels" },
  { id: "flooring-lumber", label: "Hemp flooring / lumber" },
  { id: "contracting", label: "General contracting / builder" },
  { id: "design-engineering", label: "Design / engineering services" },
  { id: "other", label: "Other hemp materials" },
] as const;

export type ProjectCategoryId = (typeof PROJECT_CATEGORY_OPTIONS)[number]["id"];

/** Keywords per category checked against vendor categories/tags/description. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  hempcrete: ["hempcrete", "hemp-lime", "hemp lime", "cast hemp", "spray"],
  hurd: ["hurd", "shiv", "aggregate", "processing", "processor", "fiber"],
  binder: ["binder", "lime", "mortar", "plaster"],
  insulation: ["insulation", "batt", "hempwool", "wool", "blown"],
  "blocks-panels": ["block", "panel", "prefab", "wall system"],
  "flooring-lumber": ["flooring", "lumber", "wood", "board", "panel"],
  contracting: ["contractor", "construction", "builder", "install", "building"],
  "design-engineering": ["architect", "design", "engineer", "consult"],
  other: ["hemp"],
};

export type MatchableVendor = {
  id: string;
  business_name: string | null;
  contact_email: string | null;
  state: string | null;
  service_areas: string[] | null;
  categories: string[] | null;
  tags: string[] | null;
  description: string | null;
};

export type ProjectForMatching = {
  state: string;
  categories: string[];
};

export type VendorMatch = {
  vendor: MatchableVendor;
  score: number;
  matchedCategories: string[];
  stateMatch: boolean;
};

const norm = (v: string) => v.toLowerCase().trim();

function vendorHaystack(vendor: MatchableVendor): string {
  return [
    ...(vendor.categories ?? []),
    ...(vendor.tags ?? []),
    vendor.description ?? "",
  ]
    .map(norm)
    .join(" | ");
}

export function scoreVendorMatch(
  vendor: MatchableVendor,
  project: ProjectForMatching
): VendorMatch {
  const haystack = vendorHaystack(vendor);
  const matchedCategories: string[] = [];

  for (const cat of project.categories) {
    const keywords = CATEGORY_KEYWORDS[norm(cat)] ?? [norm(cat)];
    if (keywords.some((k) => k && haystack.includes(k))) {
      matchedCategories.push(cat);
    }
  }

  const projectState = norm(project.state);
  const stateMatch =
    (vendor.state != null && norm(vendor.state) === projectState) ||
    (vendor.service_areas ?? []).some((s) => norm(s) === projectState);

  // Category matches dominate; state is a strong tiebreaker.
  const score = matchedCategories.length * 10 + (stateMatch ? 5 : 0);

  return { vendor, score, matchedCategories, stateMatch };
}

/**
 * Rank candidate vendors for a project. Only vendors with at least one
 * category match qualify (state alone is not enough — a lead about lime
 * binders should not go to every vendor in Tennessee).
 */
export function matchVendors(
  vendors: MatchableVendor[],
  project: ProjectForMatching,
  limit = 5
): VendorMatch[] {
  return vendors
    .map((v) => scoreVendorMatch(v, project))
    .filter((m) => m.matchedCategories.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}

/** Server-side validation shared by the form action and tests. */
export function validateProjectSubmission(input: {
  contact_name?: unknown;
  email?: unknown;
  state?: unknown;
  project_type?: unknown;
  description?: unknown;
  categories?: unknown;
}): string | null {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (!str(input.contact_name)) return "contact_name required";
  if (!str(input.email) || !str(input.email).includes("@")) return "valid email required";
  if (!/^[A-Za-z]{2}$/.test(str(input.state))) return "2-letter state required";
  if (!str(input.project_type)) return "project_type required";
  if (str(input.description).length < 20) return "description too short";
  const cats = Array.isArray(input.categories) ? input.categories : [];
  if (cats.length === 0) return "at least one category required";
  return null;
}
