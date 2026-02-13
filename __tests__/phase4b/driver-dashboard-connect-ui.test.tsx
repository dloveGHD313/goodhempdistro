import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DriverConnectCard from "@/app/driver/dashboard/DriverConnectCard";

describe("DriverConnectCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows start onboarding CTA when no Stripe account exists", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          connected: false,
          stripe_account_id: null,
          details_submitted: false,
          charges_enabled: false,
          payouts_enabled: false,
          payout_ready: false,
        }),
        { status: 200 }
      )
    );

    render(<DriverConnectCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start onboarding" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Cash Out (Coming Soon)" })).toBeDisabled();
  });

  it("shows update onboarding when Stripe account exists", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          connected: true,
          stripe_account_id: "acct_123",
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
          payout_ready: true,
        }),
        { status: 200 }
      )
    );

    render(<DriverConnectCard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Update onboarding" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Cash Out (Coming Soon)" })).not.toBeDisabled();
  });
});
