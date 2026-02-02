import { redirect } from "next/navigation";

/**
 * Short referral link: /r/[code] -> /?ref=code
 * Preserves affiliate attribution; merges ref with any existing querystring.
 */
export default async function ReferralRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { code } = await params;
  const safe = /^[A-Za-z0-9\-]+$/.test(code) ? encodeURIComponent(code) : "";
  if (!safe) {
    redirect("/");
  }
  const query = await searchParams;
  const merged = new URLSearchParams();
  merged.set("ref", safe);
  for (const [key, value] of Object.entries(query)) {
    if (key === "ref" || value === undefined) continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) merged.set(key, v);
  }
  redirect(`/?${merged.toString()}`);
}
