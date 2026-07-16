import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import {
  isAllowedStatusTransition,
  pickEpisodeFields,
} from "@/lib/jax/adminEpisodes";
import type { JaxEpisodeStatus } from "@/lib/jax/episodes";

const noStore = { "Cache-Control": "no-store" } as const;

/** PATCH: edit fields and/or transition status — admin only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminUsers(req);
  if (!adminCheck.user || !adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: noStore });
  }

  const admin = getSupabaseAdminClient();
  const { data: current } = await admin
    .from("jax_episodes")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404, headers: noStore });
  }

  const updates: Record<string, unknown> = {
    ...pickEpisodeFields(body),
    updated_at: new Date().toISOString(),
  };

  if (typeof body.status === "string" && body.status !== current.status) {
    const from = current.status as JaxEpisodeStatus;
    const to = body.status as JaxEpisodeStatus;
    if (!isAllowedStatusTransition(from, to)) {
      return NextResponse.json(
        { error: `Cannot move an episode from '${from}' to '${to}'.` },
        { status: 400, headers: noStore }
      );
    }
    updates.status = to;
    // Publishing now with no schedule: stamp the public time so early-access
    // math and ordering have an anchor.
    if (to === "published" && !body.publish_at) {
      updates.publish_at = new Date().toISOString();
    }
  }

  const { data, error } = await admin
    .from("jax_episodes")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    const message =
      error.code === "23505" ? "An episode with that slug already exists." : "Failed to update episode";
    return NextResponse.json({ error: message }, { status: 400, headers: noStore });
  }
  return NextResponse.json({ episode: data }, { headers: noStore });
}
