import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSignedUploadUrl, ALLOWED_UPLOAD_EXT, SANITIZE_FILENAME } from "@/lib/storageSignedUrls";

const BUCKET = "wholesale-certificates";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const contentType = typeof body.contentType === "string" ? body.contentType.trim() : "";

    if (!filename) {
      return NextResponse.json({ error: "filename is required" }, { status: 400 });
    }

    if (!ALLOWED_UPLOAD_EXT.test(filename)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: pdf, png, jpg, jpeg, webp" },
        { status: 400 }
      );
    }

    const safeName = filename.replace(SANITIZE_FILENAME, "_").slice(0, 200) || "file";
    const path = `${user.id}/${Date.now()}-${safeName}`;

    const result = await createSignedUploadUrl(BUCKET, path, 600);
    if (!result) {
      return NextResponse.json(
        { error: "Failed to create upload URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: result.signedUrl,
      path: result.path,
      contentType: contentType || "application/octet-stream",
    });
  } catch (error) {
    console.error("[wholesale/upload-url]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
