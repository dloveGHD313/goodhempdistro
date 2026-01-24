import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Nav from "@/components/Nav";

// Mock Next.js modules
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...(props as Record<string, unknown>)} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => {
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

interface SupabaseMock {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
}

const mockProfileSingle = vi.fn();

const supabaseMock: SupabaseMock = {
  auth: {
    getUser: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => ({
    select: () => ({
      eq: () => ({
        single: mockProfileSingle,
      }),
    }),
  })),
};

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(() => supabaseMock),
}));

describe("Nav - Logout Button", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } });
    supabaseMock.auth.signOut.mockResolvedValue({ error: null });
    mockProfileSingle.mockResolvedValue({ data: { role: null }, error: null });
    global.fetch = vi.fn();
    delete (window as Record<string, unknown>).location;
    (window as Record<string, unknown>).location = { href: "" };
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
