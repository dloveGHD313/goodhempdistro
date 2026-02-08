/**
 * Phase 3A: Moderation delete/lock logic (unit-level).
 * Tests permission shape: author, admin, or post owner can delete; lock prevents replies.
 */
import { describe, expect, it } from "vitest";

/** Mirror of comment delete permission logic (author, admin, or post owner can delete) */
function canDeleteComment(
  commentAuthorId: string,
  userId: string,
  isAdmin: boolean,
  postAuthorId: string | undefined
): boolean {
  const isAuthor = commentAuthorId === userId;
  const isPostOwner = postAuthorId === userId;
  return isAdmin || isAuthor || isPostOwner;
}

/** Reply allowed only when parent exists, not deleted, and not locked */
function canReplyToComment(
  parent: { is_deleted?: boolean; is_locked?: boolean } | null
): boolean {
  if (!parent) return false;
  if (parent.is_deleted) return false;
  if (parent.is_locked) return false;
  return true;
}

describe("Phase 3A: moderation delete/lock logic", () => {
  describe("comment delete permission shape", () => {
    it("author can delete own comment", () => {
      expect(
        canDeleteComment("user-1", "user-1", false, "post-owner")
      ).toBe(true);
    });

    it("admin can delete any comment", () => {
      expect(
        canDeleteComment("user-1", "admin-1", true, "user-2")
      ).toBe(true);
    });

    it("post owner can delete comment on their post", () => {
      expect(
        canDeleteComment("user-1", "post-owner", false, "post-owner")
      ).toBe(true);
    });

    it("random user cannot delete others' comment", () => {
      expect(
        canDeleteComment("user-1", "user-2", false, "user-3")
      ).toBe(false);
    });
  });

  describe("lock prevents replies", () => {
    it("reply allowed when parent not deleted and not locked", () => {
      expect(canReplyToComment({ is_deleted: false, is_locked: false })).toBe(true);
    });

    it("reply not allowed when parent is locked", () => {
      expect(canReplyToComment({ is_deleted: false, is_locked: true })).toBe(false);
    });

    it("reply not allowed when parent is deleted", () => {
      expect(canReplyToComment({ is_deleted: true, is_locked: false })).toBe(false);
    });

    it("reply not allowed when parent is null", () => {
      expect(canReplyToComment(null)).toBe(false);
    });
  });
});
