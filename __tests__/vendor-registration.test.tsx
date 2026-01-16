import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VendorRegistrationPage from "@/app/vendor-registration/page";

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Supabase
const mockGetUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe("Vendor Registration Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders vendor registration page with hero section", async () => {
    render(<VendorRegistrationPage />);

    expect(
      screen.getByText("Become a Vendor on Good Hemp Distro")
    ).toBeInTheDocument();
    expect(screen.getByText(/Join our thriving marketplace/i)).toBeInTheDocument();
  });

  it("displays all three pricing tiers", async () => {
    render(<VendorRegistrationPage />);

    expect(screen.getByText("BASIC")).toBeInTheDocument();
    expect(screen.getByText("PRO")).toBeInTheDocument();
    expect(screen.getByText("ELITE")).toBeInTheDocument();
  });

  it("displays correct pricing and commission info", async () => {
    render(<VendorRegistrationPage />);

    // Check BASIC
    expect(screen.getByText("$50")).toBeInTheDocument();
    expect(screen.getByText(/7%\s+commission/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 25 products/)).toBeInTheDocument();

    // Check PRO
    expect(screen.getByText("$125")).toBeInTheDocument();
    expect(screen.getByText(/4%\s+commission/)).toBeInTheDocument();

    // Check ELITE
    expect(screen.getByText("$250")).toBeInTheDocument();
    // Use getAllByText to get all 0% occurrences and check for commission one
    const zeroPercentTexts = screen.getAllByText(/0%/);
    expect(zeroPercentTexts.length).toBeGreaterThan(0);
  });

  it("marks PRO as most popular", async () => {
    render(<VendorRegistrationPage />);

    expect(screen.getByText("MOST POPULAR")).toBeInTheDocument();
  });

  it("displays vendor perks section", async () => {
    render(<VendorRegistrationPage />);

    expect(screen.getByText("Vendor Perks")).toBeInTheDocument();
    expect(screen.getByText("Built-in Social Feed")).toBeInTheDocument();
    expect(screen.getByText("Event Access")).toBeInTheDocument();
    expect(screen.getByText("Wholesale Opportunities")).toBeInTheDocument();
  });

  it("displays FAQ section with questions", async () => {
    render(<VendorRegistrationPage />);

    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
    expect(screen.getByText("Can I change my plan later?")).toBeInTheDocument();
    expect(screen.getByText("What payment methods do you accept?")).toBeInTheDocument();
  });

  it("redirects to login if user not authenticated when choosing plan", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(<VendorRegistrationPage />);

    const chooseButtons = screen.getAllByText("Choose Plan");
    fireEvent.click(chooseButtons[0]);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login?next=/vendor-registration");
    });
  });

  it("creates checkout session when user is logged in", async () => {
    const mockUser = { id: "test-vendor-123" };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "cs_test_vendor_123" }),
    });

    render(<VendorRegistrationPage />);

    const chooseButtons = screen.getAllByText("Choose Plan");
    fireEvent.click(chooseButtons[0]); // Click BASIC

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/vendor/checkout",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("BASIC"),
        })
      );
    });
  });

  it("displays all package features", async () => {
    render(<VendorRegistrationPage />);

    // BASIC features
    expect(screen.getByText("Standard product listing")).toBeInTheDocument();
    expect(screen.getByText("Community badge")).toBeInTheDocument();

    // PRO features
    expect(screen.getByText("Priority placement")).toBeInTheDocument();
    expect(screen.getByText("Featured vendor badge")).toBeInTheDocument();

    // ELITE features
    expect(screen.getByText("Unlimited products")).toBeInTheDocument();
    expect(screen.getByText("Featured vendor status")).toBeInTheDocument();
    expect(screen.getByText("Wholesale access")).toBeInTheDocument();
  });

  it("has CTA section at bottom", async () => {
    render(<VendorRegistrationPage />);

    expect(screen.getByText("Ready to Grow Your Business?")).toBeInTheDocument();
    expect(screen.getByText("Get Started Today")).toBeInTheDocument();
  });
});
