import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VendorRegistrationPage from "@/app/vendor-registration/page";

const mockPackages = [
  {
    id: "pkg-basic",
    slug: "basic",
    name: "Basic",
    monthly_price_cents: 5000,
    commission_bps: 700,
    product_limit: 25,
    event_limit: 5,
    featured: false,
    wholesale_access: false,
    perks: ["Starter listing", "Limited events", "Basic analytics"],
  },
  {
    id: "pkg-plus",
    slug: "plus",
    name: "Plus",
    monthly_price_cents: 12500,
    commission_bps: 400,
    product_limit: 100,
    event_limit: null,
    featured: false,
    wholesale_access: false,
    perks: ["Unlimited events", "More visibility", "Priority placement"],
  },
  {
    id: "pkg-premium",
    slug: "premium",
    name: "Premium",
    monthly_price_cents: 25000,
    commission_bps: 200,
    product_limit: null,
    event_limit: null,
    featured: true,
    wholesale_access: true,
    perks: ["Featured vendor", "Discounted COAs", "Wholesale access"],
  },
];

// Mock Supabase
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mockPackages, error: null }),
        }),
      }),
    }),
  }),
}));

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

    expect(await screen.findByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Plus")).toBeInTheDocument();
    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("displays correct pricing and commission info", async () => {
    render(<VendorRegistrationPage />);

    expect(await screen.findByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText(/7%\s+commission/)).toBeInTheDocument();
    expect(screen.getByText(/25 products/)).toBeInTheDocument();

    expect(screen.getByText("$125.00")).toBeInTheDocument();
    expect(screen.getByText(/4%\s+commission/)).toBeInTheDocument();

    expect(screen.getByText("$250.00")).toBeInTheDocument();
    expect(screen.getByText(/2%\s+commission/)).toBeInTheDocument();
  });

  it("marks Premium as most popular", async () => {
    render(<VendorRegistrationPage />);

    expect(await screen.findByText("MOST POPULAR")).toBeInTheDocument();
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

  it("displays all package features", async () => {
    render(<VendorRegistrationPage />);

    expect(await screen.findByText("Starter listing")).toBeInTheDocument();
    expect(screen.getByText("Limited events")).toBeInTheDocument();

    expect(screen.getByText("Priority placement")).toBeInTheDocument();
    expect(screen.getByText("More visibility")).toBeInTheDocument();

    expect(screen.getByText("Featured vendor")).toBeInTheDocument();
    expect(screen.getByText("Wholesale access")).toBeInTheDocument();
  });

  it("has CTA section at bottom", async () => {
    render(<VendorRegistrationPage />);

    expect(await screen.findByText("Ready to Grow Your Business?")).toBeInTheDocument();
    expect(screen.getByText("Get Started Today")).toBeInTheDocument();
  });

  it("marks a package as selected when chosen", async () => {
    render(<VendorRegistrationPage />);

    const chooseButtons = await screen.findAllByText("Choose Plan");
    fireEvent.click(chooseButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Selected")).toBeInTheDocument();
    });
  });
});
