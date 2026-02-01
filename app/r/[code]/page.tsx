import { redirect } from "next/navigation";

/**
 * Short referral link: /r/[code] -> /?ref=code
 * Preserves affiliate attribution; client can capture ref from query via lib/referral.
 */
export default async function ReferralRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const safe = /^[A-Za-z0-9\-]+$/.test(code) ? encodeURIComponent(code) : "";
  if (!safe) {
    redirect("/");
  }
  redirect(`/?ref=${safe}`);
}
