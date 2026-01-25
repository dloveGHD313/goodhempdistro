import fs from "fs";
import path from "path";
import type { Page, TestInfo, Response } from "@playwright/test";

type ConsoleEntry = { type: string; text: string };
type RequestFailure = { url: string; method: string; failure: string };
type ResponseIssue = { url: string; status: number; method: string };

export const authStatePath = (role: "consumer" | "vendor" | "admin") =>
  path.join(__dirname, ".auth", `${role}.json`);

export const hasAuthState = (role: "consumer" | "vendor" | "admin") => {
  const file = authStatePath(role);
  if (!fs.existsSync(file)) return false;
  try {
    const contents = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(contents.cookies) && contents.cookies.length > 0;
  } catch {
    return false;
  }
};

export const createDiagnostics = (page: Page) => {
  const consoleErrors: ConsoleEntry[] = [];
  const pageErrors: string[] = [];
  const requestFailures: RequestFailure[] = [];
  const responseIssues: ResponseIssue[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || "unknown",
    });
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) {
      responseIssues.push({
        url: response.url(),
        status,
        method: response.request().method(),
      });
    }
  });

  const attach = async (testInfo: TestInfo) => {
    await testInfo.attach("console-errors", {
      body: JSON.stringify(consoleErrors, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach("page-errors", {
      body: JSON.stringify(pageErrors, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach("request-failures", {
      body: JSON.stringify(requestFailures, null, 2),
      contentType: "application/json",
    });
    await testInfo.attach("response-issues", {
      body: JSON.stringify(responseIssues, null, 2),
      contentType: "application/json",
    });
  };

  return { consoleErrors, pageErrors, requestFailures, responseIssues, attach };
};

export const gotoAndCheck = async (
  page: Page,
  path: string,
  testInfo: TestInfo
): Promise<Response | null> => {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  if (!response) {
    await testInfo.attach("navigation-error", {
      body: `No response returned for ${path}`,
      contentType: "text/plain",
    });
    throw new Error(`No response returned for ${path}`);
  }
  if (!response.ok()) {
    await testInfo.attach("navigation-error", {
      body: `Navigation to ${path} failed with ${response.status()}`,
      contentType: "text/plain",
    });
    throw new Error(`Navigation to ${path} failed with ${response.status()}`);
  }
  return response;
};
