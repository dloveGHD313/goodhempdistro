import { NextRequest, NextResponse } from "next/server";
import { emailSpamVerdict, honeypotTripped, HONEYPOT_FIELD } from "@/lib/server/antiSpam";
import { requireHumanFromRequest } from "@/lib/server/turnstile";

const MAX_FIELD = 200;
const MAX_MESSAGE = 5000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }
    if (name.length > MAX_FIELD || subject.length > MAX_FIELD || message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Bot gate (server-side): honeypot + disposable/alias email patterns get a
    // generic success so bots learn nothing. (The old WordPress contact form
    // collected ~15 spam submissions with zero real leads — CEO audit 9/1/26.)
    if (honeypotTripped(body?.[HONEYPOT_FIELD]) || emailSpamVerdict(email).block) {
      console.warn("[contact] blocked bot submission");
      return NextResponse.json(
        { success: true, message: "Thank you for your message. We'll get back to you within 24-48 hours." },
        { status: 200 }
      );
    }

    // Human verification (Cloudflare Turnstile) — no-op until keys are set.
    const humanError = await requireHumanFromRequest(req, body);
    if (humanError) {
      return NextResponse.json({ error: humanError }, { status: 403 });
    }

    // In a real application, you would:
    // 1. Save to database (e.g., Supabase)
    // 2. Send email notification
    // 3. Add to support ticket system

    // For now, we'll just log and return success
    console.log("Contact form submission:", {
      name,
      email,
      subject,
      message: message.substring(0, 100) + "...",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Thank you for your message. We'll get back to you within 24-48 hours."
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to submit message. Please try again later." },
      { status: 500 }
    );
  }
}
