/**
 * Phase 5 (Ask JAX): $50/month global cost cap + system-prompt safety pins.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const selectChain = {
  gte: vi.fn(),
};
const fromMock = vi.fn(() => ({
  select: vi.fn(() => selectChain),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: rpcMock,
    from: fromMock,
  }),
}));

import {
  computeCostCents,
  getCurrentMonthCostCents,
  getMonthlyGlobalCostCapCents,
  incrementGlobalDailyWithCost,
  JAX_GPT4O_MINI_INPUT_CENTS_PER_TOKEN,
  JAX_GPT4O_MINI_OUTPUT_CENTS_PER_TOKEN,
  JAX_MONTHLY_GLOBAL_COST_CAP_CENTS_DEFAULT,
} from "@/lib/jax/usage";
import {
  buildSystemPrompt,
  JAX_LEGAL_REFUSAL,
  JAX_MEDICAL_DISCLAIMER,
  JAX_OFF_TOPIC_REFUSAL,
} from "@/lib/jax/systemPrompt";

describe("cost constants", () => {
  it("pins gpt-4o-mini pricing ($0.15/M input, $0.60/M output) in cents per token", () => {
    expect(JAX_GPT4O_MINI_INPUT_CENTS_PER_TOKEN).toBeCloseTo(15 / 1_000_000, 12);
    expect(JAX_GPT4O_MINI_OUTPUT_CENTS_PER_TOKEN).toBeCloseTo(60 / 1_000_000, 12);
  });

  it("defaults the monthly cap to $50 (5000 cents)", () => {
    expect(JAX_MONTHLY_GLOBAL_COST_CAP_CENTS_DEFAULT).toBe(5000);
    const prev = process.env.JAX_MONTHLY_GLOBAL_COST_CAP_CENTS;
    delete process.env.JAX_MONTHLY_GLOBAL_COST_CAP_CENTS;
    expect(getMonthlyGlobalCostCapCents()).toBe(5000);
    process.env.JAX_MONTHLY_GLOBAL_COST_CAP_CENTS = "123";
    expect(getMonthlyGlobalCostCapCents()).toBe(123);
    process.env.JAX_MONTHLY_GLOBAL_COST_CAP_CENTS = "garbage";
    expect(getMonthlyGlobalCostCapCents()).toBe(5000);
    if (prev === undefined) delete process.env.JAX_MONTHLY_GLOBAL_COST_CAP_CENTS;
    else process.env.JAX_MONTHLY_GLOBAL_COST_CAP_CENTS = prev;
  });

  it("computeCostCents: 1M input + 1M output tokens = 75 cents", () => {
    expect(computeCostCents(1_000_000, 1_000_000)).toBeCloseTo(75, 6);
  });

  it("computeCostCents never floors small calls to zero", () => {
    // a typical ~500-token exchange must contribute cost
    expect(computeCostCents(400, 100)).toBeGreaterThan(0);
  });

  it("computeCostCents treats garbage/negative inputs as zero", () => {
    expect(computeCostCents(-5, Number.NaN)).toBe(0);
  });
});

describe("getCurrentMonthCostCents", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    selectChain.gte.mockReset();
  });

  it("returns 0 when no rows exist", async () => {
    selectChain.gte.mockResolvedValue({ data: [], error: null });
    await expect(getCurrentMonthCostCents()).resolves.toBe(0);
  });

  it("sums token counters across daily rows", async () => {
    selectChain.gte.mockResolvedValue({
      data: [
        { input_tokens: 1_000_000, output_tokens: 0 },
        { input_tokens: 0, output_tokens: 1_000_000 },
      ],
      error: null,
    });
    await expect(getCurrentMonthCostCents()).resolves.toBeCloseTo(75, 6);
  });

  it("THROWS on DB error (circuit breaker must fail closed)", async () => {
    selectChain.gte.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getCurrentMonthCostCents()).rejects.toThrow(/month read failed/);
  });
});

describe("incrementGlobalDailyWithCost", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("calls the atomic RPC with rounded non-negative token counts", async () => {
    rpcMock.mockResolvedValue({ data: 7, error: null });
    await expect(incrementGlobalDailyWithCost(120.6, -3)).resolves.toBe(7);
    expect(rpcMock).toHaveBeenCalledWith("jax_increment_global_daily_with_cost", {
      p_input_tokens: 121,
      p_output_tokens: 0,
    });
  });

  it("throws when the RPC errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("rpc down") });
    await expect(incrementGlobalDailyWithCost(1, 1)).rejects.toThrow();
  });
});

describe("system prompt safety pins", () => {
  const prompt = buildSystemPrompt({
    contextMode: "GENERIC",
    route: "/ask-jax",
    intent: "unknown",
    baseReply: "base",
    results: { type: "none", items: [] },
    suggestions: [],
    userContext: null,
  });

  it("contains the canonical off-topic refusal line", () => {
    expect(prompt).toContain(JAX_OFF_TOPIC_REFUSAL);
    expect(prompt).toContain("Do not attempt to answer off-topic questions");
  });

  it("contains the medical disclaimer", () => {
    expect(prompt).toContain(JAX_MEDICAL_DISCLAIMER);
  });

  it("contains the legal-advice refusal with the attorneys link", () => {
    expect(prompt).toContain(JAX_LEGAL_REFUSAL);
    expect(prompt).toContain("/services/cannabis-attorneys");
  });

  it("still appends user context when provided", () => {
    const withUser = buildSystemPrompt({
      contextMode: "GENERIC",
      route: "/ask-jax",
      intent: "unknown",
      baseReply: "base",
      results: { type: "none", items: [] },
      suggestions: ["a", "b"],
      userContext: { name: "DeMarcus", roles: ["admin"], location: "TN", topInterests: ["flower"] },
    });
    expect(withUser).toContain("Name: DeMarcus");
    expect(withUser).toContain("Roles: admin");
  });
});
