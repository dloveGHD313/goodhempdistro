/**
 * Email notifications for project submissions (contractor/developer lead-gen).
 *
 * - Admin alert to ADMIN_EMAILS for every submission.
 * - Lead notification to each matched vendor's contact_email.
 * - Confirmation to the submitter.
 *
 * Sends are best-effort: a failure is logged and NEVER fails the submission.
 * Pure builders exported separately so tests pin payloads without network/env.
 */

import { escapeHtml } from "@/lib/server/jaxApplicationEmails";
import type { VendorMatch } from "@/lib/server/projectMatching";

export type ProjectEmailInput = {
  contact_name: string;
  company?: string | null;
  email: string;
  phone?: string | null;
  submitter_role: string;
  project_type: string;
  state: string;
  city?: string | null;
  timeline?: string | null;
  budget_range?: string | null;
  description: string;
  categories: string[];
};

export type BuiltEmail = { subject: string; html: string };

function excerpt(value: string, max = 600): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

function detailRows(p: ProjectEmailInput): string {
  return `
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(p.contact_name)}</li>
      ${p.company ? `<li><strong>Company:</strong> ${escapeHtml(p.company)}</li>` : ""}
      <li><strong>Role:</strong> ${escapeHtml(p.submitter_role)}</li>
      <li><strong>Email:</strong> ${escapeHtml(p.email)}</li>
      ${p.phone ? `<li><strong>Phone:</strong> ${escapeHtml(p.phone)}</li>` : ""}
      <li><strong>Project type:</strong> ${escapeHtml(p.project_type)}</li>
      <li><strong>Location:</strong> ${escapeHtml(p.city ? `${p.city}, ${p.state}` : p.state)}</li>
      ${p.timeline ? `<li><strong>Timeline:</strong> ${escapeHtml(p.timeline)}</li>` : ""}
      ${p.budget_range ? `<li><strong>Budget:</strong> ${escapeHtml(p.budget_range)}</li>` : ""}
      <li><strong>Needs:</strong> ${escapeHtml(p.categories.join(", "))}</li>
    </ul>
    <p><strong>Project description:</strong></p>
    <p>${escapeHtml(excerpt(p.description))}</p>
  `;
}

export function buildProjectAdminEmail(
  p: ProjectEmailInput,
  matches: VendorMatch[],
  siteUrl: string
): BuiltEmail {
  const reviewUrl = `${siteUrl.replace(/\/$/, "")}/admin/projects`;
  const matchList =
    matches.length > 0
      ? `<p><strong>Matched vendors notified (${matches.length}):</strong> ${matches
          .map((m) => escapeHtml(m.vendor.business_name ?? m.vendor.id))
          .join(", ")}</p>`
      : "<p><strong>No vendor matches</strong> — follow up manually.</p>";
  return {
    subject: `New project lead: ${p.project_type} in ${p.state}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>New project submission</h2>
        ${detailRows(p)}
        ${matchList}
        <p><a href="${reviewUrl}">Open project leads</a></p>
      </div>
    `,
  };
}

export function buildVendorLeadEmail(
  p: ProjectEmailInput,
  match: VendorMatch,
  siteUrl: string
): BuiltEmail {
  const vendorName = match.vendor.business_name ?? "there";
  return {
    subject: `New project lead from Good Hemp Distro: ${p.project_type} in ${p.state}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>A project matching your products just came in</h2>
        <p>Hi ${escapeHtml(vendorName)},</p>
        <p>
          A ${escapeHtml(p.submitter_role)} submitted a project on
          <a href="${siteUrl}">Good Hemp Distro</a> that matches what you offer
          (${escapeHtml(match.matchedCategories.join(", "))}).
        </p>
        ${detailRows(p)}
        <p>Reply directly to the contact above, or to this email if you have questions for us.</p>
        <p>— Good Hemp Distro</p>
      </div>
    `,
  };
}

export function buildSubmitterConfirmationEmail(p: ProjectEmailInput): BuiltEmail {
  return {
    subject: "We received your project — Good Hemp Distro",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Project received</h2>
        <p>Hi ${escapeHtml(p.contact_name)},</p>
        <p>
          Thanks for submitting your ${escapeHtml(p.project_type)} project in
          ${escapeHtml(p.state)}. We route each project to the hemp vendors whose
          products and services match it — expect to hear from matched vendors,
          or from our team if we need more detail.
        </p>
        <p>— Good Hemp Distro, Nashville TN</p>
      </div>
    `,
  };
}

async function sendViaResend(params: {
  apiKey: string;
  from: string;
  to: string[];
  replyTo?: string;
  email: BuiltEmail;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      subject: params.email.subject,
      html: params.email.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));
}

/** Fire all notifications. Never throws. */
export async function sendProjectSubmissionEmails(
  p: ProjectEmailInput,
  matches: VendorMatch[]
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.EMAIL_FROM?.trim() ||
      process.env.RESEND_FROM?.trim() ||
      "noreply@goodhempdistro.com";
    if (!apiKey) {
      console.warn("[project-submit/email]", JSON.stringify({ missingResendConfig: true }));
      return;
    }
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.goodhempdistro.com";
    const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);

    const sends: Promise<void>[] = [];
    if (adminEmails.length > 0) {
      sends.push(
        sendViaResend({
          apiKey,
          from,
          to: adminEmails,
          email: buildProjectAdminEmail(p, matches, siteUrl),
        })
      );
    } else {
      console.warn("[project-submit/email]", JSON.stringify({ missingAdminEmails: true }));
    }
    for (const match of matches) {
      const to = match.vendor.contact_email?.trim();
      if (!to || !to.includes("@")) continue;
      sends.push(
        sendViaResend({
          apiKey,
          from,
          to: [to],
          replyTo: p.email,
          email: buildVendorLeadEmail(p, match, siteUrl),
        })
      );
    }
    sends.push(
      sendViaResend({
        apiKey,
        from,
        to: [p.email],
        email: buildSubmitterConfirmationEmail(p),
      })
    );

    const results = await Promise.allSettled(sends);
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[project-submit/email] send failed:", r.reason);
      }
    }
  } catch (err) {
    console.error("[project-submit/email] unexpected failure:", err);
  }
}
