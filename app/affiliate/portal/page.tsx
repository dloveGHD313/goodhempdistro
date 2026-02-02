import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Canonical Affiliate Portal URL. Redirects to the portal app at /affiliates/portal.
 */
export default function AffiliatePortalPage() {
  redirect("/affiliates/portal");
}
