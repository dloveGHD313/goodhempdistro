import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * One-way redirect: /affiliates/portal (plural) -> /affiliate/portal (canonical).
 * Prevents redirect loops; canonical URL is /affiliate/portal.
 */
export default function AffiliatesPortalRedirect() {
  redirect("/affiliate/portal");
}
