import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { pickEpisodeFields } from "@/lib/jax/adminEpisodes";

const noStore = { "Cache-Control": "no-store" } as const;

/** GET: all episodes, every status — admin only. */
export async function GET(req: NextRequest) {
  const adminCheck = await requireAdminUsers(req);
  if (!adminCheck.user || !adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("jax_episodes")
    .select("*")
    .order("episode_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "Failed to load episodes" }, { status: 500, headers: noStore });
  }
  return NextResponse.json({ episodes: data || [] }, { headers: noStore });
}

/** POST: create a draft episode — admin only. */
export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminUsers(req);
  if (!adminCheck.user || !adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!title || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "title and a kebab-case slug are required" },
      { status: 400, headers: noStore }
    );
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("jax_episodes")
    .insert({ ...pickEpisodeFields(body), title, slug, status: "draft" })
    .select("*")
    .single();
  if (error) {
    const message =
      error.code === "23505" ? "An episode with that slug already exists." : "Failed to create episode";
    return NextResponse.json({ error: message }, { status: 400, headers: noStore });
  }
  return NextResponse.json({ episode: data }, { status: 201, headers: noStore });
}
