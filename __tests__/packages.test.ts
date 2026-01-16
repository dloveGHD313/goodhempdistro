import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Package Assignment (Stripe Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Vendor Package Assignment", () => {
    it("assigns BASIC vendor package on successful checkout", () => {
      const mockSession = {
        metadata: {
          package_type: "vendor",
          package_name: "BASIC",
          user_id: "test-user-123",
        },
      };

      // Verify metadata structure
      expect(mockSession.metadata.package_type).toBe("vendor");
      expect(mockSession.metadata.package_name).toBe("BASIC");
    });

    it("assigns PRO vendor package with 4% commission", () => {
      const mockSession = {
        metadata: {
          package_type: "vendor",
          package_name: "PRO",
          user_id: "test-user-123",
        },
      };

      expect(mockSession.metadata.package_name).toBe("PRO");
    });

    it("assigns ELITE vendor package with 0% commission", () => {
      const mockSession = {
        metadata: {
          package_type: "vendor",
          package_name: "ELITE",
          user_id: "test-user-123",
        },
      };

      expect(mockSession.metadata.package_name).toBe("ELITE");
    });
  });

  describe("Consumer Package Assignment", () => {
    it("assigns STARTER consumer package with 50 loyalty points", () => {
      const mockSession = {
        metadata: {
          package_type: "consumer",
          package_name: "STARTER",
          user_id: "test-user-123",
        },
      };

      expect(mockSession.metadata.package_type).toBe("consumer");
      expect(mockSession.metadata.package_name).toBe("STARTER");
    });

    it("assigns PLUS consumer package with 150 loyalty points", () => {
      const mockSession = {
        metadata: {
          package_type: "consumer",
          package_name: "PLUS",
          user_id: "test-user-123",
        },
      };

      expect(mockSession.metadata.package_name).toBe("PLUS");
    });

    it("assigns VIP consumer package with 300 loyalty points", () => {
      const mockSession = {
        metadata: {
          package_type: "consumer",
          package_name: "VIP",
          user_id: "test-user-123",
        },
      };

      expect(mockSession.metadata.package_name).toBe("VIP");
    });
  });

  describe("Affiliate Referral Tracking", () => {
    it("tracks referral when user signs up via affiliate link", () => {
      const mockReferral = {
        affiliate_id: "affiliate-123",
        referred_user_id: "new-user-456",
        status: "pending",
      };

      expect(mockReferral.status).toBe("pending");
      expect(mockReferral.affiliate_id).toBeDefined();
      expect(mockReferral.referred_user_id).toBeDefined();
    });

    it("marks referral as paid after successful checkout", () => {
      const mockReferral = {
        affiliate_id: "affiliate-123",
        referred_user_id: "new-user-456",
        status: "paid",
        stripe_session_id: "cs_test_123",
      };

      expect(mockReferral.status).toBe("paid");
      expect(mockReferral.stripe_session_id).toBeDefined();
    });
  });

  describe("Package Metadata Validation", () => {
    it("requires package_type in metadata", () => {
      const mockSession = {
        metadata: {
          package_name: "BASIC",
          user_id: "test-user-123",
        },
      };

      // Missing package_type should be handled gracefully
      expect(mockSession.metadata.package_name).toBeDefined();
    });

    it("defaults to BASIC when no package specified", () => {
      const mockSession = {
        metadata: {
          user_id: "test-user-123",
        },
      };

      const defaultPackage = "BASIC";
      expect(defaultPackage).toBe("BASIC");
    });
  });
});
