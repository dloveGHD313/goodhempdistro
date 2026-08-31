import { describe, it, expect } from "vitest";
import {
  emailSpamVerdict,
  normalizeEmail,
  honeypotTripped,
  timingTripped,
  formSpamCheck,
} from "@/lib/server/antiSpam";

describe("emailSpamVerdict", () => {
  it("passes normal emails", () => {
    expect(emailSpamVerdict("jane@company.com").block).toBe(false);
    expect(emailSpamVerdict("john.doe@gmail.com").block).toBe(false);
    expect(emailSpamVerdict("first.last@yahoo.com").block).toBe(false);
    // Two dots is still plausibly human
    expect(emailSpamVerdict("j.r.smith@gmail.com").block).toBe(false);
  });

  it("blocks gmail dot-alias stuffing (3+ dots)", () => {
    const v = emailSpamVerdict("p.m.ors.e.pr.a.y@gmail.com");
    expect(v).toEqual({ block: true, reason: "gmail_dot_alias" });
    expect(emailSpamVerdict("a.b.c.d@googlemail.com").block).toBe(true);
    // Same pattern on non-gmail domains is allowed (dots are significant there)
    expect(emailSpamVerdict("a.b.c.d@company.com").block).toBe(false);
  });

  it("blocks disposable domains", () => {
    expect(emailSpamVerdict("x@mailinator.com")).toEqual({
      block: true,
      reason: "disposable_domain",
    });
    expect(emailSpamVerdict("x@yopmail.com").block).toBe(true);
  });

  it("blocks invalid shapes", () => {
    expect(emailSpamVerdict("not-an-email").block).toBe(true);
    expect(emailSpamVerdict("@nolocal.com").block).toBe(true);
    expect(emailSpamVerdict("nodomain@").block).toBe(true);
    expect(emailSpamVerdict("bad@nodot").block).toBe(true);
  });
});

describe("normalizeEmail", () => {
  it("strips dots and +tags on gmail", () => {
    expect(normalizeEmail("J.o.h.n+promo@Gmail.com")).toBe("john@gmail.com");
    expect(normalizeEmail("a.b@googlemail.com")).toBe("ab@googlemail.com");
  });

  it("keeps dots but strips +tags on other domains", () => {
    expect(normalizeEmail("jane.doe+x@company.com")).toBe("jane.doe@company.com");
    expect(normalizeEmail("Jane.Doe@Company.com")).toBe("jane.doe@company.com");
  });
});

describe("honeypotTripped", () => {
  it("trips only when filled", () => {
    expect(honeypotTripped("http://spam.example")).toBe(true);
    expect(honeypotTripped("   ")).toBe(false);
    expect(honeypotTripped("")).toBe(false);
    expect(honeypotTripped(null)).toBe(false);
  });
});

describe("timingTripped", () => {
  const now = 1_800_000_000_000;
  it("trips on fast, missing, garbage, or stale timestamps", () => {
    expect(timingTripped(String(now - 1000), now)).toBe(true); // 1s — too fast
    expect(timingTripped(null, now)).toBe(true);
    expect(timingTripped("garbage", now)).toBe(true);
    expect(timingTripped(String(now - 25 * 60 * 60 * 1000), now)).toBe(true); // stale
  });

  it("passes human-speed submissions", () => {
    expect(timingTripped(String(now - 10_000), now)).toBe(false); // 10s
    expect(timingTripped(String(now - 5 * 60 * 1000), now)).toBe(false); // 5min
  });
});

describe("formSpamCheck", () => {
  const now = 1_800_000_000_000;
  const okTs = String(now - 15_000);

  it("passes a legitimate submission", () => {
    expect(
      formSpamCheck({ honeypot: "", formTs: okTs, email: "jane@company.com", now })
    ).toBeNull();
  });

  it("returns the first tripped layer", () => {
    expect(
      formSpamCheck({ honeypot: "x", formTs: okTs, email: "jane@company.com", now })
    ).toBe("honeypot");
    expect(
      formSpamCheck({ honeypot: "", formTs: String(now), email: "jane@company.com", now })
    ).toBe("timing");
    expect(
      formSpamCheck({ honeypot: "", formTs: okTs, email: "a.b.c.d@gmail.com", now })
    ).toBe("gmail_dot_alias");
  });
});
