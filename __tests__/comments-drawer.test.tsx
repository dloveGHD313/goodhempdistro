import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommentsDrawer from "@/components/comments/CommentsDrawer";

vi.mock("@/components/engagement/useAuthUser", () => ({
  default: () => ({ userId: "user-1" }),
}));

vi.mock("@/components/ui/Drawer", () => ({
  default: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (next: boolean) => void;
    children: React.ReactNode;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="drawer-overlay" onClick={() => onOpenChange(false)}>
        <div data-testid="drawer-panel" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    );
  },
}));

const mockFetch = vi.fn(async (input: RequestInfo) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.includes("/api/profile")) {
    return {
      ok: true,
      json: async () => ({
        profile: { display_name: "Test User", avatar_url: null },
      }),
    } as Response;
  }
  if (url.includes("/api/posts/") && url.includes("/comments")) {
    return {
      ok: true,
      json: async () => ({ count: 0, comments: [] }),
    } as Response;
  }
  return {
    ok: true,
    json: async () => ({}),
  } as Response;
});

describe("CommentsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "CSS", {
      writable: true,
      value: { supports: vi.fn(() => false) },
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    Object.defineProperty(window, "scrollTo", {
      writable: true,
      value: vi.fn(),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows typing into the composer textarea", async () => {
    const user = userEvent.setup();
    render(
      <CommentsDrawer
        postId="post-1"
        isOpen={true}
        onClose={vi.fn()}
        commentCount={0}
        isAdmin={false}
      />
    );

    const textarea = await screen.findByLabelText("Write a comment");
    await user.type(textarea, "hello");
    expect(textarea).toHaveValue("hello");
  });

  it("does not close when clicking inside the drawer panel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CommentsDrawer
        postId="post-1"
        isOpen={true}
        onClose={onClose}
        commentCount={0}
        isAdmin={false}
      />
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const panel = await screen.findByTestId("drawer-panel");
    await user.click(panel);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when clicking the overlay", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CommentsDrawer
        postId="post-1"
        isOpen={true}
        onClose={onClose}
        commentCount={0}
        isAdmin={false}
      />
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const overlay = await screen.findByTestId("drawer-overlay");
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
