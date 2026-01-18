import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Admin-only product COA verification API
 * PATCH: Toggle coa_verified flag for a product
 */

async function checkAdminAccess() {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return { authorized: false, error: "Forbidden - Admin access required", status: 403 };
  }

  return { authorized: true, user };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const check = await checkAdminAccess();
    if (!check.authorized) {
      return NextResponse.json(
        { error: check.error },
        { status: check.status || 403 }
      );
    }

    const { id } = await params;
    const { coa_verified } = await req.json();

    if (typeof coa_verified !== "boolean") {
      return NextResponse.json(
        { error: "coa_verified must be a boolean" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from("products")
      .update({ coa_verified, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, coa_verified")
      .single();

    if (error) {
      console.error("Error updating product COA verification:", error);
      return NextResponse.json(
        { error: "Failed to update product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, product: data });
  } catch (error) {
    console.error("Product COA verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
