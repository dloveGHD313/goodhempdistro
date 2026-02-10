import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DriverConnectCard from "@/app/driver/dashboard/DriverConnectCard";

describe("DriverConnectCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows connect CTA when payout is not ready", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          connected: false,
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
      expect(screen.getByRole("button", { name: "Connect Stripe" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Cash Out (Coming Soon)" })).toBeDisabled();
  });

  it("enables cash out button when payout_ready is true", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          connected: true,
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
      expect(screen.getByText("Ready for payouts.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Cash Out (Coming Soon)" })).not.toBeDisabled();
  });
});
