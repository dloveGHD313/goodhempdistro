import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock next/navigation with overridable session id
let mockSessionId: string | null = "cs_test_123";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "session_id" ? mockSessionId : null),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Import component after mocks
const OrderSuccessPage = (await import("@/app/orders/success/page")).default;

describe("OrderConfirmation - Duplicate Processing Guard", () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    
    // Reset mocks
    vi.clearAllMocks();
    global.fetch = vi.fn();

    // Reset session id to default
    mockSessionId = "cs_test_123";
  });

  it("should process order on first visit", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderId: "order_123",
        status: "paid",
        sessionId: "cs_test_123",
      }),
    });
    global.fetch = mockFetch;

    render(<OrderSuccessPage />);

    // Should show loading state initially
    expect(screen.getByText("Processing Order...")).toBeInTheDocument();

    // Wait for order to be processed
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/orders/confirm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ sessionId: "cs_test_123" }),
        })
      );
    });

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText("Order Confirmed!")).toBeInTheDocument();
    });

    // Verify sessionStorage guard was set
    const processedKey = "order_processed_cs_test_123";
    expect(sessionStorage.getItem(processedKey)).toBeTruthy();
  });

  it("should not call API on duplicate visit", async () => {
    // Pre-populate sessionStorage to simulate previous visit
    const processedKey = "order_processed_cs_test_123";
    const orderData = {
      orderId: "order_123",
      status: "paid",
      sessionId: "cs_test_123",
    };
    sessionStorage.setItem(processedKey, JSON.stringify(orderData));

    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    render(<OrderSuccessPage />);

    // Should immediately show success without loading
    await waitFor(() => {
      expect(screen.getByText("Order Confirmed!")).toBeInTheDocument();
    });

    // Should show duplicate warning
    expect(screen.getByText(/This order has already been processed/)).toBeInTheDocument();

    // API should NOT be called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle missing session_id", () => {
    // Override mock to return null session_id
    mockSessionId = null;

    render(<OrderSuccessPage />);

    expect(screen.getByText("Invalid Order")).toBeInTheDocument();
  });

  it("should handle API error gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("API Error"));
    global.fetch = mockFetch;

    render(<OrderSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText("Order Failed")).toBeInTheDocument();
    });
  });
});
