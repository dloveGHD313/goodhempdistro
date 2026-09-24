import Link from "next/link";
import { getFoundingClaim } from "@/lib/server/founding";
import { formatFoundingNumber } from "@/lib/founding";

/**
 * "Founding Member #007" chip for signed-in founding members (server component).
 * Renders nothing for everyone else, so it is safe to drop on any page.
 */
export default async function FoundingBadge({ userId, className = "" }: { userId: string | null | undefined; className?: string }) {
  const claim = await getFoundingClaim(userId);
  if (!claim) return null;
  return (
    <Link
      href="/founding"
      className={`inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/60 bg-[#C9A84C]/10 px-3 py-1 text-sm font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/20 transition ${className}`}
      data-testid="founding-badge"
      title={`Founding member since ${new Date(claim.activated_at ?? claim.claimed_at).toLocaleDateString("en-US")}`}
    >
      <span aria-hidden="true">★</span>
      Founding Member {formatFoundingNumber(claim.founding_number!)}
    </Link>
  );
}
