import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildJaxAdminNotificationEmail,
  buildJaxApplicantConfirmationEmail,
  escapeHtml,
  parseAdminEmails,
  sendJaxApplicationEmails,
  type JaxApplicationEmailInput,
} from "@/lib/server/jaxApplicationEmails";

const app: JaxApplicationEmailInput = {
  name: "Jane Grower",
  business_name: "Hemp & Home <LLC>",
  email: "jane@example.com",
  phone: "615-555-0100",
  website_url: "https://hempandhome.example",
  vendor_type: "product_brand",
  why_featured: 'We make hempcrete blocks & panels "locally" in TN.',
};

describe("escapeHtml", () => {
  it("escapes all HTML-significant characters", () => {
    expect(escapeHtml(`<img src=x onerror="a&b'c">`)).toBe(
      "&lt;img src=x onerror=&quot;a&amp;b&#39;c&quot;&gt;"
    );
  });
});

describe("buildJaxAdminNotificationEmail", () => {
  it("includes applicant fields, escaped, and the pending-review link", () => {
    const email = buildJaxAdminNotificationEmail(app, "https://www.goodhempdistro.com/");
    expect(email.subject).toBe(
      "New Learning with JAX application: Hemp & Home <LLC>"
    );
    expect(email.html).toContain("Jane Grower");
    expect(email.html).toContain("Hemp &amp; Home &lt;LLC&gt;");
    expect(email.html).not.toContain("<LLC>");
    expect(email.html).toContain(
      "https://www.goodhempdistro.com/admin/jax-applications?status=pending"
    );
  });

  it("omits optional rows when absent", () => {
    const email = buildJaxAdminNotificationEmail(
      { ...app, phone: null, website_url: null },
      "https://www.goodhempdistro.com"
    );
    expect(email.html).not.toContain("Phone:");
    expect(email.html).not.toContain("Website:");
  });
});

describe("buildJaxApplicantConfirmationEmail", () => {
  it("addresses the applicant, names the business, makes no selection promise", () => {
    const email = buildJaxApplicantConfirmationEmail(app);
    expect(email.subject).toBe("We received your Learning with JAX application");
    expect(email.html).toContain("Jane Grower");
    expect(email.html).toContain("Hemp &amp; Home &lt;LLC&gt;");
    expect(email.html.toLowerCase()).not.toContain("you have been selected");
    expect(email.html.toLowerCase()).not.toContain("guarantee");
  });
});

describe("parseAdminEmails", () => {
  it("splits, trims, and drops invalid entries", () => {
    expect(parseAdminEmails(" a@b.com , c@d.com ,, not-an-email ")).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});

describe("sendJaxApplicationEmails", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "GHD <no-reply@goodhempdistro.com>");
    vi.stubEnv("ADMIN_EMAILS", "admin@goodhempdistro.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.goodhempdistro.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends admin + applicant emails via Resend", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await sendJaxApplicationEmails(app);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map((c) =>
      JSON.parse(String(c[1]?.body))
    );
    const recipients = bodies.flatMap((b) => b.to);
    expect(recipients).toContain("admin@goodhempdistro.com");
    expect(recipients).toContain("jane@example.com");
  });

  it("never throws when Resend fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendJaxApplicationEmails(app)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("falls back to RESEND_FROM, then the domain default, when EMAIL_FROM is unset", async () => {
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("RESEND_FROM", "");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await sendJaxApplicationEmails(app);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const froms = fetchMock.mock.calls.map(
      (c) => JSON.parse(String(c[1]?.body)).from
    );
    expect(froms).toEqual([
      "noreply@goodhempdistro.com",
      "noreply@goodhempdistro.com",
    ]);
  });

  it("does nothing (and does not throw) when the Resend API key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(sendJaxApplicationEmails(app)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
