import { redirect } from "next/navigation";

/**
 * Short referral link: /r/[code] -> /?ref=code
 * Preserves affiliate attribution; client can capture ref from query via lib/referral.
 */
export default async function ReferralRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { code } = await params;
  const safe = /^[A-Za-z0-9\-]+$/.test(code) ? encodeURIComponent(code) : "";
  if (!safe) {
    redirect("/");
  }
  const query = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry) query.append(key, entry);
        });
      } else if (typeof value === "string" && value.length > 0) {
        query.append(key, value);
      }
    }
  }
  query.set("ref", safe);
  redirect(`/?${query.toString()}`);
}
