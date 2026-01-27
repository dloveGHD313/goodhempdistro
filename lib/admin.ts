const DEFAULT_ADMIN_EMAILS_DEV = ["hellogoodhempdistros@gmail.com"];

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (raw && raw.trim().length > 0) {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeEmail);
  }

  if (process.env.NODE_ENV !== "production") {
    return DEFAULT_ADMIN_EMAILS_DEV;
  }

  return [];
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }
  const normalized = normalizeEmail(email);
  return getAdminEmails().includes(normalized);
}
