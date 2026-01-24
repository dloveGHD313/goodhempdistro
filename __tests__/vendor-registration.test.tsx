import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import VendorRegistrationPage from "@/app/vendor-registration/page";

const mockGetUser = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockHasVendorContext = vi.fn();
const mockVendorApplication = vi.fn();
const mockVendorRow = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("next/cache", () => ({
  unstable_noStore: () => undefined,
}));

vi.mock("@/lib/authz", () => ({
  hasVendorContext: (...args: unknown[]) => mockHasVendorContext(...args),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle:
            table === "vendor_applications" ? mockVendorApplication : mockVendorRow,
        }),
      }),
    }),
  }),
}));

describe("Vendor Registration Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasVendorContext.mockResolvedValue({
      hasContext: false,
      hasVendor: false,
    });
    mockVendorApplication.mockResolvedValue({ data: null, error: null });
    mockVendorRow.mockResolvedValue({ data: null, error: null });
  });

  it("redirects to login when no user session exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(VendorRegistrationPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login?redirect=/vendor-registration");
  });

  it("renders vendor form when user has no vendor context", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    const ui = await VendorRegistrationPage();
    render(ui);

    expect(
      screen.getByText("Create Your Vendor Account")
    ).toBeInTheDocument();
  });

  it("renders pending status when application exists", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockHasVendorContext.mockResolvedValue({
      hasContext: true,
      hasVendor: false,
      _debug: null,
    });
    mockVendorApplication.mockResolvedValue({
      data: {
        id: "app-123",
        user_id: "user-123",
        business_name: "Test Brand",
        status: "pending",
        created_at: "2024-01-01T00:00:00.000Z",
      },
      error: null,
    });

    const ui = await VendorRegistrationPage();
    render(ui);

    expect(screen.getByText("Vendor Account")).toBeInTheDocument();
    expect(screen.getByText("Test Brand")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(
      screen.getByText(/pending review/i)
    ).toBeInTheDocument();
  });
});
