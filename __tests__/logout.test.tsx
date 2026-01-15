import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Nav from "@/components/Nav";

// Mock Next.js modules
vi.mock("next/image", () => ({
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...props} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => {
    return <a href={href}>{children}</a>;
  },
}));

vi.mock("@/lib/site", () => ({
  site: {
    name: "Good Hemp Distro",
    nav: [
      { label: "Products", href: "/products" },
      { label: "Vendors", href: "/vendors" },
    ],
  },
}));

const supabaseMock = {
  auth: {
    getUser: vi.fn(),
    signOut: vi.fn(),
  },
};

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(() => supabaseMock as any),
}));

describe("Nav - Logout Button", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    supabaseMock.auth.signOut.mockResolvedValue({ error: null });
    global.fetch = vi.fn();
    delete (window as any).location;
    (window as any).location = { href: "" };
  });

  it("should render logout button when user is logged in", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: "123", email: "test@example.com" } },
    });

    render(<Nav />);

    await waitFor(() => {
      expect(screen.getByText("Logout")).toBeInTheDocument();
    });
  });

  it("should call logout API and redirect on logout button click", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: "123", email: "test@example.com" } },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    render(<Nav />);

    await waitFor(() => {
      expect(screen.getByText("Logout")).toBeInTheDocument();
    });

    const logoutButton = screen.getByText("Logout");
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    // Verify hard redirect
    await waitFor(() => {
      expect(window.location.href).toBe("/");
    });
  });

  it("should redirect even if API call fails", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: "123", email: "test@example.com" } },
    });

    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = mockFetch;

    render(<Nav />);

    await waitFor(() => {
      expect(screen.getByText("Logout")).toBeInTheDocument();
    });

    const logoutButton = screen.getByText("Logout");
    fireEvent.click(logoutButton);

    // Should still redirect even on error
    await waitFor(() => {
      expect(window.location.href).toBe("/");
    });
  });
});
