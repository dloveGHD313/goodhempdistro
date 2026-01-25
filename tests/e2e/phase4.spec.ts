import { test, expect } from "@playwright/test";
import { createDiagnostics, gotoAndCheck, hasAuthState, authStatePath } from "./utils";

const allowWrites = process.env.AUDIT_ALLOW_WRITES === "1";

const getFirstDetailLink = async (page: any, prefix: string) => {
  const links = await page.locator(`a[href^="${prefix}"]`).all();
  for (const link of links) {
    const href = await link.getAttribute("href");
    if (href && href.startsWith(prefix) && href.length > prefix.length + 1) {
      return href;
    }
  }
  return null;
};

test.describe("Phase 4 - Anonymous flows", () => {
  test("Home loads and nav routes render", async ({ page }, testInfo) => {
    const diag = createDiagnostics(page);
    await gotoAndCheck(page, "/", testInfo);

    const routes = [
      "/discover",
      "/vendors",
      "/products",
      "/services",
      "/events",
      "/wholesale",
      "/blog",
      "/affiliate",
      "/vendor-registration",
    ];

    for (const route of routes) {
      await gotoAndCheck(page, route, testInfo);
    }

    await diag.attach(testInfo);
  });

  test("Directory and detail pages load", async ({ page }, testInfo) => {
    const diag = createDiagnostics(page);

    await gotoAndCheck(page, "/vendors", testInfo);
    await expect(page.getByRole("heading", { name: /vendors/i })).toBeVisible();
    const vendorLink = await getFirstDetailLink(page, "/vendors/");
    if (vendorLink) {
      await gotoAndCheck(page, vendorLink, testInfo);
    } else {
      await testInfo.attach("vendors-empty", {
        body: "No vendor detail links found.",
        contentType: "text/plain",
      });
    }

    await gotoAndCheck(page, "/products", testInfo);
    const productLink = await getFirstDetailLink(page, "/products/");
    if (productLink) {
      await gotoAndCheck(page, productLink, testInfo);
    } else {
      await testInfo.attach("products-empty", {
        body: "No product detail links found.",
        contentType: "text/plain",
      });
    }

    await gotoAndCheck(page, "/services", testInfo);
    const serviceLink = await getFirstDetailLink(page, "/services/");
    if (serviceLink) {
      await gotoAndCheck(page, serviceLink, testInfo);
    } else {
      await testInfo.attach("services-empty", {
        body: "No service detail links found.",
        contentType: "text/plain",
      });
    }

    await gotoAndCheck(page, "/events", testInfo);
    const eventLink = await getFirstDetailLink(page, "/events/");
    if (eventLink) {
      await gotoAndCheck(page, eventLink, testInfo);
    } else {
      await testInfo.attach("events-empty", {
        body: "No event detail links found.",
        contentType: "text/plain",
      });
    }

    await diag.attach(testInfo);
  });

  test("Legal pages load", async ({ page }, testInfo) => {
    const diag = createDiagnostics(page);
    await gotoAndCheck(page, "/privacy", testInfo);
    await gotoAndCheck(page, "/terms", testInfo);
    await gotoAndCheck(page, "/refunds", testInfo);
    await diag.attach(testInfo);
  });
});

test.describe("Phase 4 - Consumer flows", () => {
  test.use({ storageState: authStatePath("consumer") });

  test.beforeEach(() => {
    if (!hasAuthState("consumer")) {
      test.skip("Consumer auth state not available.");
    }
  });

  test("Consumer onboarding gate", async ({ page }, testInfo) => {
    const diag = createDiagnostics(page);
    await gotoAndCheck(page, "/dashboard", testInfo);
    const url = page.url();
    expect(url).toMatch(/\/dashboard|\/onboarding\/consumer/);
    await diag.attach(testInfo);
  });

  test("Favorites and reviews", async ({ page }, testInfo) => {
    const diag = createDiagnostics(page);
    if (!allowWrites) {
      test.skip("AUDIT_ALLOW_WRITES is not enabled.");
    }

    await gotoAndCheck(page, "/products", testInfo);
    const saveButton = page.locator("button:has-text(\"Save\")").first();
    if (await saveButton.count()) {
      await saveButton.click();
    } else {
      await testInfo.attach("favorites-skip", {
        body: "No Save buttons found on products page.",
        contentType: "text/plain",
      });
    }

    await gotoAndCheck(page, "/account/favorites", testInfo);
    await expect(page.getByText("You have no favorites yet.")).toHaveCount(0);

    const productLink = await getFirstDetailLink(page, "/products/");
    if (productLink) {
      await gotoAndCheck(page, productLink, testInfo);
      await page.fill("input[placeholder=\"Quick summary\"]", "Audit review");
      await page.fill("textarea[placeholder=\"Share your experience\"]", "Audit review body");
      await page.click("button:has-text(\"Submit review\")");
      await expect(page.getByText("Audit review")).toBeVisible({ timeout: 30_000 });
    } else {
      await testInfo.attach("review-skip", {
        body: "No product detail link found for review flow.",
        contentType: "text/plain",
      });
    }

    await diag.attach(testInfo);
  });
});

test.describe("Phase 4 - Vendor flows", () => {
  test.use({ storageState: authStatePath("vendor") });

  test.beforeEach(() => {
    if (!hasAuthState("vendor")) {
      test.skip("Vendor auth state not available.");
    }
  });

  test("Vendor onboarding and dashboard navigation", async ({ page }, testInfo) => {
    const diag = createDiagnostics(page);
    await gotoAndCheck(page, "/vendors/dashboard", testInfo);
    const url = page.url();
    expect(url).toMatch(/\/vendors\/dashboard|\/onboarding\/vendor|\/vendor-registration/);
    await diag.attach(testInfo);
  });
});

test.describe("Phase 4 - Admin flows", () => {
  test.use({ storageState: authStatePath("admin") });

  test.beforeEach(() => {
    if (!hasAuthState("admin")) {
      test.skip("Admin auth state not available.");
    }
  });

  test("Admin review queues load", async ({ page }, testInfo) => {
    const diag = createDiagnostics(page);
    await gotoAndCheck(page, "/admin/products", testInfo);
    await gotoAndCheck(page, "/admin/events", testInfo);
    await gotoAndCheck(page, "/admin/services", testInfo);
    await diag.attach(testInfo);
  });
});
