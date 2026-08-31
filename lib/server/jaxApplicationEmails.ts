/**
 * Email notifications for Learning with JAX feature applications.
 *
 * - Admin alert to ADMIN_EMAILS when a new application lands.
 * - Confirmation to the applicant so the lead stays warm.
 *
 * Sends are best-effort: a failure is logged and NEVER fails the submission.
 * Pure builders are exported separately so tests can pin the payloads
 * without network or env.
 */

export type JaxApplicationEmailInput = {
  name: string;
  business_name: string;
  email: string;
  phone?: string | null;
  website_url?: string | null;
  vendor_type: string;
  why_featured: string;
};

export type BuiltEmail = {
  subject: string;
  html: string;
};

/** Minimal HTML escaping — applicant fields are untrusted input rendered into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function excerpt(value: string, max = 400): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

export function buildJaxAdminNotificationEmail(
  app: JaxApplicationEmailInput,
  siteUrl: string
): BuiltEmail {
  const reviewUrl = `${siteUrl.replace(/\/$/, "")}/admin/jax-applications?status=pending`;
  return {
    subject: `New Learning with JAX application: ${app.business_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>New Learning with JAX feature application</h2>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(app.name)}</li>
          <li><strong>Business:</strong> ${escapeHtml(app.business_name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(app.email)}</li>
          ${app.phone ? `<li><strong>Phone:</strong> ${escapeHtml(app.phone)}</li>` : ""}
          ${app.website_url ? `<li><strong>Website:</strong> ${escapeHtml(app.website_url)}</li>` : ""}
          <li><strong>Vendor type:</strong> ${escapeHtml(app.vendor_type)}</li>
        </ul>
        <p><strong>Why they want to be featured:</strong></p>
        <p>${escapeHtml(excerpt(app.why_featured))}</p>
        <p><a href="${reviewUrl}">Review pending applications</a></p>
      </div>
    `,
  };
}

export function buildJaxApplicantConfirmationEmail(
  app: JaxApplicationEmailInput
): BuiltEmail {
  return {
    subject: "We received your Learning with JAX application",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Application received</h2>
        <p>Hi ${escapeHtml(app.name)},</p>
        <p>
          Thanks for applying to be featured on <strong>Learning with JAX</strong>.
          We've received your application for <strong>${escapeHtml(app.business_name)}</strong>
          and our team reviews submissions in the order they arrive.
        </p>
        <p>
          If your business is a fit for an upcoming episode, we'll reach out at this
          email address with next steps. No action is needed from you right now.
        </p>
        <p>
          Questions? Just reply to this email.
        </p>
        <p>— The Good Hemp Distro team</p>
      </div>
    `,
  };
}

async function sendViaResend(params: {
  apiKey: string;
  from: string;
  to: string[];
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
      subject: params.email.subject,
      html: params.email.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));
}

/**
 * Fire both notification emails. Never throws — logs and returns on any failure
 * so the application submission always succeeds regardless of email state.
 */
export async function sendJaxApplicationEmails(
  app: JaxApplicationEmailInput
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    if (!apiKey || !from) {
      console.warn(
        "[jax-feature-form/email]",
        JSON.stringify({ missingResendConfig: true })
      );
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
          email: buildJaxAdminNotificationEmail(app, siteUrl),
        })
      );
    } else {
      console.warn(
        "[jax-feature-form/email]",
        JSON.stringify({ missingAdminEmails: true })
      );
    }
    sends.push(
      sendViaResend({
        apiKey,
        from,
        to: [app.email],
        email: buildJaxApplicantConfirmationEmail(app),
      })
    );

    const results = await Promise.allSettled(sends);
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[jax-feature-form/email] send failed:", r.reason);
      }
    }
  } catch (err) {
    console.error("[jax-feature-form/email] unexpected failure:", err);
  }
}
