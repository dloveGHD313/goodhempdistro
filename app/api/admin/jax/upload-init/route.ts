import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { JAX_MEDIA_BUCKET } from "@/lib/jax/episodes";
import { jaxMediaPath, validateJaxMedia, type JaxMediaKind } from "@/lib/jax/adminEpisodes";

const noStore = { "Cache-Control": "no-store" } as const;

/**
 * POST: signed upload URL for episode media (brief 2026-07-16 P1 §3).
 * The #215 pattern: file bytes go browser → Supabase Storage directly —
 * videos are far beyond Vercel's 4.5MB request-body edge limit. Admin
 * only. Body: { episode_id, kind: video|teaser|thumbnail, mime, size }.
 * Returns { bucket, path, token }; the client uploads with
 * uploadToSignedUrl, then PATCHes the path onto the episode.
 */
export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminUsers(req);
  if (!adminCheck.user || !adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const episodeId = typeof body?.episode_id === "string" ? body.episode_id.trim() : "";
  const kind = body?.kind as JaxMediaKind;
  const mime = typeof body?.mime === "string" ? body.mime : "";
  const size = typeof body?.size === "number" ? body.size : 0;

  if (!episodeId || !["video", "teaser", "thumbnail"].includes(kind)) {
    return NextResponse.json(
      { error: "episode_id and kind (video|teaser|thumbnail) are required" },
      { status: 400, headers: noStore }
    );
  }

  const validation = validateJaxMedia(kind, mime, size);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400, headers: noStore });
  }

  const admin = getSupabaseAdminClient();
  const { data: episode } = await admin
    .from("jax_episodes")
    .select("id")
    .eq("id", episodeId)
    .maybeSingle();
  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404, headers: noStore });
  }

  const path = jaxMediaPath(episodeId, kind, validation.ext);
  // Replacing media: remove any prior object at this path so the signed
  // upload (insert-only) can't collide.
  await admin.storage.from(JAX_MEDIA_BUCKET).remove([path]);
  const { data, error } = await admin.storage
    .from(JAX_MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data?.token) {
    console.error("[admin/jax/upload-init] signed URL failed:", error?.message);
    return NextResponse.json(
      { error: "Could not prepare the upload. Please try again." },
      { status: 500, headers: noStore }
    );
  }
  return NextResponse.json(
    { bucket: JAX_MEDIA_BUCKET, path, token: data.token },
    { headers: noStore }
  );
}
