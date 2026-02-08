import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { isAdminEmail } from "@/lib/admin";

const COA_BUCKET = "coas";
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * POST: Upload COA for a product. Vendor must own the product.
 * Path: vendors/{owner_user_id}/products/{product_id}/coa/{uuid}-filename
 * COA never blocks product creation; this is optional post-create.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { isAdmin: isAdminByTable } = await requireAdminUsers(req);
    const isAdmin = isAdminByTable || isAdminEmail(user.email);

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, owner_user_id, vendor_id")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const ownerId = product.owner_user_id ?? null;
    let canUpload = isAdmin || ownerId === user.id;
    if (!canUpload && product.vendor_id) {
      const { data: v } = await supabase
        .from("vendors")
        .select("owner_user_id")
        .eq("id", product.vendor_id)
        .maybeSingle();
      canUpload = v?.owner_user_id === user.id;
    }
    if (!canUpload) {
      return NextResponse.json({ error: "You do not own this product" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") ?? formData.get("coa");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided; use form field 'file' or 'coa'" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File must be PDF or image (PNG, JPG, WEBP)" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File size must be under 50MB" }, { status: 400 });
    }

    // SSOT: storagePath and owner_user_id MUST use product owner so vendor can read after admin upload
    const productOwnerId = ownerId ?? user.id;
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const prefix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}`;
    const storagePath = `vendors/${productOwnerId}/products/${productId}/coa/${prefix}-${safeName}`;

    // Admin uploads to vendor path: use admin client to bypass RLS (path[2] must match auth.uid() for user client)
    const adminClient = getSupabaseAdminClient();
    const storageClient = isAdmin ? adminClient.storage : supabase.storage;
    const { error: uploadError } = await storageClient
      .from(COA_BUCKET)
      .upload(storagePath, file, { upsert: false, cacheControl: "3600" });

    if (uploadError) {
      console.error("[coa/upload]", { productId, error: uploadError.message });
      return NextResponse.json(
        { error: "Upload failed", details: uploadError.message },
        { status: 500 }
      );
    }

    const docPayload = {
      product_id: productId,
      owner_user_id: productOwnerId,
      type: "coa" as const,
      storage_bucket: COA_BUCKET,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      status: "pending" as const,
    };

    const dbClient = isAdmin ? adminClient : supabase;
    const { data: doc, error: insertError } = await dbClient
      .from("product_documents")
      .upsert(
        { ...docPayload, updated_at: new Date().toISOString() },
        { onConflict: "product_id,type", ignoreDuplicates: false }
      )
      .select("id, storage_path, status, created_at")
      .single();

    if (insertError) {
      console.error("[coa/insert]", { productId, error: insertError.message });
      return NextResponse.json(
        { error: "Failed to record document", details: insertError.message },
        { status: 500 }
      );
    }

    await dbClient
      .from("products")
      .update({
        coa_object_path: storagePath,
        coa_uploaded_at: new Date().toISOString(),
      })
      .eq("id", productId);

    return NextResponse.json({
      documentId: doc?.id,
      storage_path: storagePath,
      status: doc?.status ?? "pending",
      created_at: doc?.created_at,
    });
  } catch (err) {
    console.error("[coa/upload] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
