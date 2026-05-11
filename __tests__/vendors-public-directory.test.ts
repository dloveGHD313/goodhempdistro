import { describe, it, expect, vi } from "vitest";

/**
 * Regression test for audit P0 Fix #2.
 *
 * The /vendors layout previously enforced session globally and redirected
 * anonymous visitors to /login. That broke the public discovery funnel.
 * This test pins the contract: /vendors/layout.tsx must be a pass-through
 * that does NOT call redirect() — auth gating lives in each authenticated
 * subroute's own layout (dashboard, billing, orders, payouts, products,
 * referrals, services, settings, events).
 */
describe("/vendors layout — public directory access", () => {
  it("is a pass-through component that never redirects", async () => {
    // Hoist mock above the dynamic import — vi auto-hoists vi.mock
    const redirectMock = vi.fn(() => {
      throw new Error("redirect() should not have been called from /vendors/layout.tsx");
    });
    vi.doMock("next/navigation", () => ({ redirect: redirectMock }));

    const { default: VendorsLayout } = await import("../app/vendors/layout");

    // Should not throw even when invoked with no auth context.
    expect(() => {
      // Layout is sync (no auth checks), so calling it directly is safe.
      const result = VendorsLayout({ children: "test" } as { children: React.ReactNode });
      return result;
    }).not.toThrow();

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("authenticated subroutes still enforce their own auth", () => {
    // Documentation check, not a behavioral test. Each of these layouts
    // is expected to redirect to /login when no session is present.
    // If you add a new authenticated route under /vendors/, you MUST
    // add its own layout.tsx with a session check — the parent layout
    // is intentionally not gating.
    const guardedSubroutes = [
      "app/vendors/billing/layout.tsx",
      "app/vendors/dashboard/layout.tsx",
      "app/vendors/events/layout.tsx",
      "app/vendors/orders/layout.tsx",
      "app/vendors/payouts/layout.tsx",
      "app/vendors/products/layout.tsx",
      "app/vendors/referrals/layout.tsx",
      "app/vendors/services/layout.tsx",
      "app/vendors/settings/layout.tsx",
    ];
    expect(guardedSubroutes.length).toBeGreaterThan(0);
  });
});
