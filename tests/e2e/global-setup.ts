import fs from "fs";
import path from "path";
import { chromium } from "@playwright/test";

const baseURL = process.env.AUDIT_BASE_URL || "https://goodhempdistro.com";
const authDir = path.join(__dirname, ".auth");

type Role = "consumer" | "vendor" | "admin";

const roleEnv = (role: Role, suffix: "EMAIL" | "PASSWORD") =>
  process.env[`AUDIT_${role.toUpperCase()}_${suffix}`];

const storagePathFor = (role: Role) => path.join(authDir, `${role}.json`);

const ensureAuthDir = () => {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
};

const writeEmptyState = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ cookies: [], origins: [] }, null, 2));
  }
};

const loginAndSave = async (role: Role, email: string, password: string, headless: boolean) => {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=\"submit\"]");

  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 90_000,
  });

  const storagePath = storagePathFor(role);
  await context.storageState({ path: storagePath });
  await browser.close();
  console.log(`[audit] Saved auth state for ${role} to ${storagePath}`);
};

const manualLoginAndSave = async (role: Role) => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`[audit] Manual login required for ${role}.`);
  console.log(`[audit] Please complete login in the opened browser window.`);

  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 5 * 60 * 1000,
  });

  const storagePath = storagePathFor(role);
  await context.storageState({ path: storagePath });
  await browser.close();
  console.log(`[audit] Saved manual auth state for ${role} to ${storagePath}`);
};

export default async function globalSetup() {
  ensureAuthDir();

  const roles: Role[] = ["consumer", "vendor", "admin"];
  const manualRole = (process.env.AUDIT_MANUAL_LOGIN_ROLE || "").toLowerCase() as Role;

  for (const role of roles) {
    const email = roleEnv(role, "EMAIL");
    const password = roleEnv(role, "PASSWORD");

    if (email && password) {
      await loginAndSave(role, email, password, true);
    } else if (manualRole === role && process.env.AUDIT_MANUAL_LOGIN === "1") {
      await manualLoginAndSave(role);
    } else {
      writeEmptyState(storagePathFor(role));
    }
  }
}
