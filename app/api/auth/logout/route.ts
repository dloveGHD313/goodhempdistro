import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// GET handler - redirects to home (for browser navigation)
export async function GET() {
  redirect("/");
}

export async function POST() {
  try {
    // Create Supabase server client
    const supabase = await createSupabaseServerClient();
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Supabase signOut error:', error);
      // Continue even if Supabase signOut fails - we'll clear cookies anyway
    }

    // Clear all auth-related cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Remove Supabase auth cookies
    allCookies.forEach((cookie) => {
      if (
        cookie.name.startsWith('sb-') || 
        cookie.name.includes('supabase') ||
        cookie.name.includes('auth')
      ) {
        cookieStore.delete(cookie.name);
      }
    });

    // Return success response
    return NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout API error:', error);
    
    // Even on error, return success to allow client-side redirect
    // The client will clear local state regardless
    return NextResponse.json(
      { 
        success: true, 
        message: 'Logout completed with warnings',
        error: String(error)
      },
      { status: 200 }
    );
  }
}
