import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { requireVendorActive } from "@/lib/server/vendorStatusGate";
import { isAdminEmail } from "@/lib/admin";

const COA_BUCKET = "coas";
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * POST: Upload COA for a product. Vendor or admin (on behalf of owner).
 * Path: vendors/{product_owner_user_id}/products/{product_id}/coa/{uuid}-filename
 * product_documents.owner_user_id = product owner so vendor can read after admin upload.
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

    const vendorStatusResult = await requireVendorActive(user.id, user.email);
    if (!vendorStatusResult.allowed) {
      return NextResponse.json(vendorStatusResult.json, { status: vendorStatusResult.status });
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

    const adminClient = getSupabaseAdminClient();
    const dbClient = isAdmin ? adminClient : supabase;
    const storageClient = isAdmin ? adminClient.storage : supabase.storage;

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

    // Fetch existing COA path to delete orphaned file after re-upload (dbClient so admin can see vendor row)
    const { data: existingDoc } = await dbClient
      .from("product_documents")
      .select("storage_path")
      .eq("product_id", productId)
      .eq("type", "coa")
      .maybeSingle();
    const oldStoragePath = existingDoc?.storage_path ?? null;

    // SSOT: storagePath MUST use product owner (owner_user_id) so vendor can read after admin upload
    const productOwnerId = ownerId ?? user.id;
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const prefix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}`;
    const storagePath = `vendors/${productOwnerId}/products/${productId}/coa/${prefix}-${safeName}`;

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
      admin_note: null,
    };

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

    // Delete orphaned previous file (UNIQUE(product_id,type) overwrites DB record; old blob left behind).
    // Always use admin storage so RLS does not block: old path may be vendors/{other_uid}/... (e.g. admin
    // upload for vendor, or product ownership change) and DELETE policy requires foldername(name)[2] = auth.uid().
    if (oldStoragePath && oldStoragePath !== storagePath) {
      try {
        const { error: delErr } = await getSupabaseAdminClient().storage
          .from(COA_BUCKET)
          .remove([oldStoragePath]);
        if (delErr) {
          console.warn("[coa/upload] failed to delete orphaned file:", {
            productId,
            oldPath: oldStoragePath,
            error: delErr.message,
          });
        }
      } catch (delEx) {
        console.warn("[coa/upload] error deleting orphaned file:", delEx);
      }
    }

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
