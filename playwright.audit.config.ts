import { defineConfig } from "@playwright/test";
import path from "path";

const baseURL = process.env.AUDIT_BASE_URL || "https://goodhempdistro.com";
const authDir = path.join(__dirname, "tests", "e2e", ".auth");

export default defineConfig({
  testDir: path.join(__dirname, "tests", "e2e"),
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: true,
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  globalSetup: path.join(authDir, "..", "global-setup.ts"),
});
