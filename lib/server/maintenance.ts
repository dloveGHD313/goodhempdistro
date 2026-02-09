function normalizeFlag(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

export function isMaintenanceModeEnabled(): boolean {
  const flag = normalizeFlag(process.env.MAINTENANCE_MODE);
  return flag === "1" || flag === "true";
}

export const MAINTENANCE_ALLOWLIST_PREFIXES: string[] = ["/maintenance", "/_next", "/favicon.ico"];

export const MAINTENANCE_ALLOWLIST_ROUTES: string[] = ["/login", "/signup", "/reset-password"];

/** API paths allowed during maintenance. Edge-safe (no Node fs/path). */
export const MAINTENANCE_ALLOWLIST_API_PREFIXES: string[] = ["/api/health", "/api/auth"];

