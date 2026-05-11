import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AgeGate from "@/components/AgeGate";

describe("AgeGate (warning model)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
    Object.defineProperty(window.document, "cookie", {
      value: "",
      writable: true,
    });
  });

  it("shows banner when no cookie and no localStorage", async () => {
    render(<AgeGate />);
    expect(
      await screen.findByText(/You must be 21\+ to purchase/i)
    ).toBeInTheDocument();
  });

  it("dismisses after accept and sets cookie/localStorage with 1-year max-age", async () => {
    render(<AgeGate />);
    const enterBtn = await screen.findByRole("button", { name: /I am 21\+/i });
    fireEvent.click(enterBtn);
    await waitFor(() => {
      expect(document.cookie.includes("ghd_age_verified=true")).toBe(true);
      expect(document.cookie.includes("max-age=31536000")).toBe(true);
    });
  });

  it("decline navigates to /come-back-later (not external)", async () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign: assignMock, pathname: "/" } as any,
      writable: true,
    });
    render(<AgeGate />);
    const declineBtn = await screen.findByRole("button", { name: /Under 21/i });
    fireEvent.click(declineBtn);
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("/come-back-later");
    });
  });

  it("does not render on /come-back-later (avoid showing banner on the decline page itself)", async () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/come-back-later" } as any,
      writable: true,
    });
    const { container } = render(<AgeGate />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
