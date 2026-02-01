import { redirect } from "next/navigation";

/**
 * Short vendor referral link: /vr/[code] -> /vendor-registration?vr=code
 * Client can capture vr from query and store in cookie for attribution on signup.
 */
export default async function VendorReferralRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const safe = /^[A-Za-z0-9\-]+$/.test(code) ? encodeURIComponent(code) : "";
  if (!safe) {
    redirect("/vendor-registration");
  }
  redirect(`/vendor-registration?vr=${safe}`);
}
