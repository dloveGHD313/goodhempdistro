import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AffiliatePage from "@/app/affiliate/page";

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Supabase client
const mockGetUser = vi.fn();
const mockAffiliateSingle = vi.fn();
const mockReferralOrder = vi.fn();
const mockAffiliateInsertSingle = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => {
      if (table === "affiliates") {
        return {
          select: () => ({
            eq: () => ({
              single: mockAffiliateSingle,
            }),
          }),
          insert: () => ({
            select: () => ({
              single: mockAffiliateInsertSingle,
            }),
          }),
        };
      }
      if (table === "affiliate_referrals") {
        return {
          select: () => ({
            eq: () => ({
              order: mockReferralOrder,
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn(),
          }),
        }),
      };
    },
  }),
}));

describe("Affiliate Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://test-site.com";

    mockReferralOrder.mockResolvedValue({ data: [] });
  });

  it("redirects to login when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(<AffiliatePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("renders Your Referral Link section for authenticated users", async () => {
    const mockUser = { id: "test-user-123" };
    const mockAffiliate = {
      id: "affiliate-123",
      user_id: "test-user-123",
      affiliate_code: "TESTUSER-ABC123",
      reward_cents: 0,
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockAffiliateSingle.mockResolvedValue({ data: mockAffiliate });

    render(<AffiliatePage />);

    await waitFor(() => {
      expect(screen.getByText("Your Referral Link")).toBeInTheDocument();
    });
  });

  it("displays referral link with correct format", async () => {
    const mockUser = { id: "test-user-123" };
    const mockAffiliate = {
      id: "affiliate-123",
      user_id: "test-user-123",
      affiliate_code: "TESTCODE",
      reward_cents: 0,
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockAffiliateSingle.mockResolvedValue({ data: mockAffiliate });

    render(<AffiliatePage />);

    await waitFor(() => {
      const input = screen.getByDisplayValue(/\?ref=TESTCODE/i);
      expect(input).toBeInTheDocument();
    });
  });

  it("copies referral link to clipboard when Copy button clicked", async () => {
    const mockUser = { id: "test-user-123" };
    const mockAffiliate = {
      id: "affiliate-123",
      user_id: "test-user-123",
      affiliate_code: "TESTCODE",
      reward_cents: 0,
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockAffiliateSingle.mockResolvedValue({ data: mockAffiliate });

    render(<AffiliatePage />);

    await waitFor(() => {
      expect(screen.getByText("Your Referral Link")).toBeInTheDocument();
    });

    const copyButton = screen.getByRole("button", { name: /Copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(screen.getByText("✓ Copied!")).toBeInTheDocument();
    });
  });

  it("shows Your Rewards section with $5, $15, $25 tiers", async () => {
    const mockUser = { id: "test-user-123" };
    const mockAffiliate = {
      id: "affiliate-123",
      user_id: "test-user-123",
      affiliate_code: "TESTCODE",
      reward_cents: 0,
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockAffiliateSingle.mockResolvedValue({ data: mockAffiliate });

    render(<AffiliatePage />);

    await waitFor(() => {
      expect(screen.getByText("Your Rewards")).toBeInTheDocument();
      expect(screen.getByText("$5")).toBeInTheDocument();
      expect(screen.getByText("$15")).toBeInTheDocument();
      expect(screen.getByText("$25")).toBeInTheDocument();
    });
  });

  it("displays referral history table", async () => {
    const mockUser = { id: "test-user-123" };
    const mockAffiliate = {
      id: "affiliate-123",
      user_id: "test-user-123",
      affiliate_code: "TESTCODE",
      reward_cents: 0,
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockAffiliateSingle.mockResolvedValue({ data: mockAffiliate });

    render(<AffiliatePage />);

    await waitFor(() => {
      expect(screen.getByText("Referral History")).toBeInTheDocument();
    });
  });

  it("creates affiliate code on first visit", async () => {
    const mockUser = { id: "test-user-123" };

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockAffiliateSingle.mockResolvedValue({ data: null }); // No existing affiliate
    mockAffiliateInsertSingle.mockResolvedValue({
      data: {
        id: "new-affiliate-123",
        user_id: "test-user-123",
        affiliate_code: "TESTUSER-XYZ",
        reward_cents: 0,
      },
    });

    render(<AffiliatePage />);

    await waitFor(() => {
      expect(screen.getByText("Your Referral Link")).toBeInTheDocument();
    });
  });
});
