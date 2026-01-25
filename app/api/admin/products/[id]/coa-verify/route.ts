import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Admin-only product COA verification API
 * PATCH: Toggle coa_verified flag for a product
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
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
