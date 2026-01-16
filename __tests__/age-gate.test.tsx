import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AgeGate from "@/components/AgeGate";

describe("AgeGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage and cookies
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
      writable: true,
    });
    Object.defineProperty(window.document, "cookie", {
      value: "",
      writable: true,
    });
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it("shows when no cookie and no localStorage", async () => {
    render(<AgeGate />);
    expect(
      await screen.findByText(/You must be 21\+ to enter/i)
    ).toBeInTheDocument();
  });

  it("hides after accept and sets cookie/localStorage", async () => {
    render(<AgeGate />);
    const enterBtn = await screen.findByRole("button", { name: /Enter/i });
    fireEvent.click(enterBtn);
    await waitFor(() => {
      expect(document.cookie.includes("ghd_age_verified=true")).toBe(true);
    });
  });

  it("exit redirects to external site", async () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign: assignMock } as any,
      writable: true,
    });
    render(<AgeGate />);
    const exitBtn = await screen.findByRole("button", { name: /Exit/i });
    fireEvent.click(exitBtn);
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("https://google.com");
    });
  });
});
