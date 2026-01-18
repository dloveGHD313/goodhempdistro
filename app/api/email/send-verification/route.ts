import { NextRequest, NextResponse } from "next/server";

/**
 * Optional email verification API using Resend
 * This is a fallback if you want custom email sending beyond Supabase's built-in emails
 * 
 * By default, Supabase handles email verification automatically when:
 * - Email confirmation is enabled in Supabase dashboard
 * - Users sign up via auth.signUp()
 * 
 * This endpoint is for custom email sending needs.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, verificationUrl, token } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if Resend is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM || "noreply@goodhempdistro.com";

    if (!resendApiKey) {
      // If Resend is not configured, Supabase will handle emails
      return NextResponse.json(
        { 
          message: "Resend not configured. Supabase handles email verification automatically.",
          supabaseHandlesEmail: true 
        },
        { status: 200 }
      );
    }

    // If Resend is configured, send custom email
    // Note: You'll need to install @resend/node: npm install resend
    // For now, this is a placeholder that returns success
    
    // Example implementation (requires @resend/node):
    // const { Resend } = require('resend');
    // const resend = new Resend(resendApiKey);
    // await resend.emails.send({
    //   from: resendFrom,
    //   to: email,
    //   subject: 'Verify your Good Hemp Distro account',
    //   html: getVerificationEmailTemplate(verificationUrl)
    // });

    return NextResponse.json(
      { 
        message: "Verification email would be sent via Resend",
        note: "Install @resend/node and uncomment code to enable"
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Email verification API error:", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}

/**
 * Email template for verification (HTML)
 */
function getVerificationEmailTemplate(verificationUrl: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://goodhempdistro.com";
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Account</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: #84cc16; margin: 0;">🌿 Good Hemp Distro</h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">Verify Your Email Address</h2>
          <p>Thank you for signing up! Please verify your email address to complete your registration.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="display: inline-block; background-color: #84cc16; color: #0f172a; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Verify Email Address
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-size: 12px; color: #999; word-break: break-all; background-color: #fff; padding: 10px; border-radius: 4px;">
            ${verificationUrl}
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #666;">
          <p>This email was sent by Good Hemp Distro. If you didn't sign up, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
  `;
}
