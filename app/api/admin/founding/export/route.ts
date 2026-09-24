import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listFoundingMembers } from "@/lib/server/founding";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET: founding members roster as CSV — admin only. */
export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminCheck.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await listFoundingMembers();
  const header = [
    "founding_number", "status", "name", "email", "business", "vendor_status", "billing_after_trial", "first_charge",
    "stripe_subscription_status", "stripe_subscription_id", "source", "signed_up_at", "activated_at", "user_id",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.founding_number, r.status, r.display_name, r.email, r.vendor_business_name, r.vendor_status,
        r.billing_interval ? (r.billing_interval === "year" ? "enterprise_annual" : "enterprise_monthly") : "",
        r.trial_end, r.subscription_status, r.stripe_subscription_id, r.source, r.claimed_at, r.activated_at, r.user_id,
      ].map(csvCell).join(",")
    ),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="founding-members-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
