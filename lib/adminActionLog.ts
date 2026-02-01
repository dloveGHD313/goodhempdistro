/**
 * Write an entry to admin_action_logs (audit log for moderation).
 * Call from admin-only routes after successful action; uses admin client for insert.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminActionLogPayload = {
  actor_user_id: string | null;
  actor_email: string | null;
  action: "approve" | "reject" | "set_active" | "set_inactive" | "delete" | "status";
  entity_type?: "product";
  entity_id: string;
  prev_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeAdminActionLog(
  admin: SupabaseClient,
  payload: AdminActionLogPayload
): Promise<{ error: Error | null }> {
  try {
    const { error } = await admin.from("admin_action_logs").insert({
      actor_user_id: payload.actor_user_id ?? null,
      actor_email: payload.actor_email ?? null,
      action: payload.action,
      entity_type: payload.entity_type ?? "product",
      entity_id: payload.entity_id,
      prev_status: payload.prev_status ?? null,
      new_status: payload.new_status ?? null,
      reason: payload.reason ?? null,
      metadata: payload.metadata ?? null,
    });
    if (error) {
      console.error("[adminActionLog] insert error", error);
      return { error };
    }
    return { error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[adminActionLog] exception", err);
    return { error: err };
  }
}
