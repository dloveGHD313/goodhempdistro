import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadLogPayload = {
  event?: "attempt" | "error";
  bucket?: string;
  key?: string;
  errorCode?: string | null;
};

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: UploadLogPayload = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const event = payload.event || "attempt";
  const bucket = payload.bucket || "unknown";
  const key = payload.key || "unknown";
  const errorCode = payload.errorCode || "none";

  console.log(
    `[debug/storage-upload] event=${event} bucket=${bucket} key=${key} errorCode=${errorCode}`
  );

  return NextResponse.json({ ok: true });
}
