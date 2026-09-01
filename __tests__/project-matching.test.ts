/**
 * Build: project submissions → vendor matching (contractor/developer lead-gen).
 */

import { describe, expect, it } from "vitest";

import {
  matchVendors,
  scoreVendorMatch,
  validateProjectSubmission,
  PROJECT_CATEGORY_OPTIONS,
  type MatchableVendor,
} from "@/lib/server/projectMatching";
import {
  buildProjectAdminEmail,
  buildVendorLeadEmail,
  buildSubmitterConfirmationEmail,
  type ProjectEmailInput,
} from "@/lib/server/projectSubmissionEmails";

const vendor = (over: Partial<MatchableVendor>): MatchableVendor => ({
  id: "v-" + Math.random().toString(36).slice(2, 8),
  business_name: "Test Vendor",
  contact_email: "vendor@example.com",
  state: null,
  service_areas: null,
  categories: null,
  tags: null,
  description: null,
  ...over,
});

describe("scoreVendorMatch", () => {
  it("matches vendors by category keywords in categories/tags/description", () => {
    const v = vendor({ categories: ["Hempcrete Installation"], state: "TN" });
    const m = scoreVendorMatch(v, { state: "TN", categories: ["hempcrete"] });
    expect(m.matchedCategories).toEqual(["hempcrete"]);
    expect(m.stateMatch).toBe(true);
    expect(m.score).toBe(15);
  });

  it("matches via description when categories are empty", () => {
    const v = vendor({ description: "We produce lime binder and plasters" });
    const m = scoreVendorMatch(v, { state: "TX", categories: ["binder"] });
    expect(m.matchedCategories).toEqual(["binder"]);
    expect(m.stateMatch).toBe(false);
  });

  it("counts service_areas as a state match", () => {
    const v = vendor({ categories: ["insulation"], service_areas: ["tn", "KY"] });
    const m = scoreVendorMatch(v, { state: "TN", categories: ["insulation"] });
    expect(m.stateMatch).toBe(true);
  });
});

describe("matchVendors", () => {
  const project = { state: "TN", categories: ["hempcrete", "binder"] };

  it("requires at least one category match — state alone never qualifies", () => {
    const tnOnly = vendor({ state: "TN", categories: ["candles"] });
    expect(matchVendors([tnOnly], project)).toHaveLength(0);
  });

  it("ranks in-state category matches above out-of-state ones", () => {
    const outOfState = vendor({ id: "out", categories: ["hempcrete"], state: "PA" });
    const inState = vendor({ id: "in", categories: ["hempcrete"], state: "TN" });
    const ranked = matchVendors([outOfState, inState], project);
    expect(ranked.map((m) => m.vendor.id)).toEqual(["in", "out"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      vendor({ id: `v${i}`, categories: ["hempcrete"] })
    );
    expect(matchVendors(many, project, 5)).toHaveLength(5);
  });
});

describe("validateProjectSubmission", () => {
  const valid = {
    contact_name: "DeMarcus",
    email: "d@example.com",
    state: "TN",
    project_type: "new_build_residential",
    description: "A 1200 sq ft hempcrete ADU in Nashville needing hurd and binder.",
    categories: ["hempcrete"],
  };

  it("accepts a valid submission", () => {
    expect(validateProjectSubmission(valid)).toBeNull();
  });

  it("rejects missing name, bad email, bad state, short description, empty categories", () => {
    expect(validateProjectSubmission({ ...valid, contact_name: " " })).toMatch(/contact_name/);
    expect(validateProjectSubmission({ ...valid, email: "nope" })).toMatch(/email/);
    expect(validateProjectSubmission({ ...valid, state: "Tennessee" })).toMatch(/state/);
    expect(validateProjectSubmission({ ...valid, description: "too short" })).toMatch(/description/);
    expect(validateProjectSubmission({ ...valid, categories: [] })).toMatch(/category/);
  });

  it("every advertised category option has matching keywords", () => {
    // Guard: each option in the public form can actually match a vendor.
    for (const opt of PROJECT_CATEGORY_OPTIONS) {
      const v = vendor({ description: opt.label.toLowerCase() });
      const m = scoreVendorMatch(v, { state: "TN", categories: [opt.id] });
      expect(m.matchedCategories, `option ${opt.id} should be matchable`).toContain(opt.id);
    }
  });
});

describe("email builders", () => {
  const input: ProjectEmailInput = {
    contact_name: "Jane <script>",
    company: "BuildCo",
    email: "jane@example.com",
    phone: null,
    submitter_role: "contractor",
    project_type: "retrofit_insulation",
    state: "TN",
    city: "Nashville",
    timeline: "0-3 months",
    budget_range: "25k_100k",
    description: "Insulating a 1950s home with hemp batts.",
    categories: ["insulation"],
  };
  const match = {
    vendor: vendor({ business_name: "Hempitecture", contact_email: "sales@hempitecture.com" }),
    score: 15,
    matchedCategories: ["insulation"],
    stateMatch: true,
  };

  it("admin email lists matches and escapes HTML", () => {
    const email = buildProjectAdminEmail(input, [match], "https://www.goodhempdistro.com");
    expect(email.subject).toContain("retrofit_insulation");
    expect(email.html).toContain("Hempitecture");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("/admin/projects");
  });

  it("admin email flags zero matches for manual follow-up", () => {
    const email = buildProjectAdminEmail(input, [], "https://www.goodhempdistro.com");
    expect(email.html).toContain("No vendor matches");
  });

  it("vendor lead email includes matched categories and submitter contact", () => {
    const email = buildVendorLeadEmail(input, match, "https://www.goodhempdistro.com");
    expect(email.html).toContain("insulation");
    expect(email.html).toContain("jane@example.com");
  });

  it("submitter confirmation addresses the submitter", () => {
    const email = buildSubmitterConfirmationEmail(input);
    expect(email.html).toContain("Jane");
    expect(email.subject).toContain("received");
  });
});
