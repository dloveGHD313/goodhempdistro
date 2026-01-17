import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
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
