export function ensureReferralCode(
  existingCode: string | null,
  generate: () => string
) {
  return existingCode && existingCode.length > 0 ? existingCode : generate();
}
