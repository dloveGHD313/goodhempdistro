import { existsSync } from "node:fs";
import path from "node:path";

function normalizeFlag(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

export function isMaintenanceModeEnabled(): boolean {
  const flag = normalizeFlag(process.env.MAINTENANCE_MODE);
  return flag === "1" || flag === "true";
}

export const MAINTENANCE_ALLOWLIST_PREFIXES: string[] = ["/maintenance", "/_next", "/favicon.ico"];

export const MAINTENANCE_ALLOWLIST_ROUTES: string[] = ["/login", "/signup", "/reset-password"];

const apiPrefixes: string[] = ["/api/health"];

// Conditionally allow /api/auth/* only if the directory exists in this repo
(() => {
  try {
    const authApiDir = path.join(process.cwd(), "app", "api", "auth");
    if (existsSync(authApiDir)) {
      apiPrefixes.push("/api/auth");
    } else {
      // Note: /api/auth not present in repo; maintenance allowlist will not include it.
      // This log is intentionally minimal and non-sensitive.
      console.log("[maintenance] /app/api/auth not found; /api/auth not allowlisted during maintenance");
    }
  } catch {
    // On any filesystem error, fail closed: do not add /api/auth to allowlist.
  }
})();

export const MAINTENANCE_ALLOWLIST_API_PREFIXES: string[] = apiPrefixes;

