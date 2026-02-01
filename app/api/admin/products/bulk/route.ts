import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { writeAdminActionLog } from "@/lib/adminActionLog";
import { revalidatePath } from "next/cache";

const VALID_ACTIONS = ["approve", "reject", "set_active", "set_inactive", "delete"] as const;
const MIN_REJECT_REASON_LENGTH = 5;

type BulkResult = { id: string; status: "success" } | { id: string; status: "failed"; error: string };

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    let body: { action?: string; productIds?: string[]; reason?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const action = typeof body.action === "string" ? body.action : "";
    const productIds = Array.isArray(body.productIds) ? body.productIds.filter((id) => typeof id === "string") : [];
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
      return NextResponse.json(
        { ok: false, error: "Invalid action. Use: approve, reject, set_active, set_inactive, delete" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (productIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "productIds must be a non-empty array" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (action === "reject" && reason.length < MIN_REJECT_REASON_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `Rejection reason is required and must be at least ${MIN_REJECT_REASON_LENGTH} characters` },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: products } = await admin
      .from("products")
      .select("id, status, active")
      .in("id", productIds);

    const productMap = new Map((products || []).map((p) => [p.id, p]));

    const allowedStatusForAction: Record<string, string[]> = {
      approve: ["pending_review"],
      reject: ["pending_review"],
      set_active: ["approved"],
      set_inactive: ["approved"],
      delete: ["draft", "pending_review", "approved", "rejected"],
    };
    const requiredStatuses = allowedStatusForAction[action] || [];
    const invalid: { id: string; error: string }[] = [];
    for (const id of productIds) {
      const p = productMap.get(id);
      if (!p) {
        invalid.push({ id, error: "Product not found" });
        continue;
      }
      if (!requiredStatuses.includes(p.status)) {
        invalid.push({ id, error: `Invalid status: ${p.status}. Allowed: ${requiredStatuses.join(", ")}` });
      }
    }
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `${invalid.length} product(s) cannot be ${action}: invalid status or not found`,
          invalid,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const results: BulkResult[] = [];
    const actor = {
      actor_user_id: adminCheck.user.id,
      actor_email: adminCheck.user.email ?? null,
    };

    for (const id of productIds) {
      const p = productMap.get(id)!;
      try {
        if (action === "approve") {
          const { error: updateError } = await admin
            .from("products")
            .update({
              status: "approved",
              active: true,
              reviewed_at: new Date().toISOString(),
              reviewed_by: adminCheck.user.id,
              rejection_reason: null,
            })
            .eq("id", id);
          if (updateError) {
            results.push({ id, status: "failed", error: updateError.message });
            continue;
          }
          await writeAdminActionLog(admin, {
            ...actor,
            action: "approve",
            entity_id: id,
            prev_status: p.status,
            new_status: "approved",
          });
        } else if (action === "reject") {
          const { error: updateError } = await admin
            .from("products")
            .update({
              status: "rejected",
              active: false,
              reviewed_at: new Date().toISOString(),
              reviewed_by: adminCheck.user.id,
              rejection_reason: reason,
            })
            .eq("id", id);
          if (updateError) {
            results.push({ id, status: "failed", error: updateError.message });
            continue;
          }
          await writeAdminActionLog(admin, {
            ...actor,
            action: "reject",
            entity_id: id,
            prev_status: p.status,
            new_status: "rejected",
            reason,
          });
        } else if (action === "set_active") {
          const { error: updateError } = await admin.from("products").update({ active: true }).eq("id", id);
          if (updateError) {
            results.push({ id, status: "failed", error: updateError.message });
            continue;
          }
          await writeAdminActionLog(admin, {
            ...actor,
            action: "set_active",
            entity_id: id,
            prev_status: p.status,
            new_status: "approved",
            metadata: { active: true },
          });
        } else if (action === "set_inactive") {
          const { error: updateError } = await admin.from("products").update({ active: false }).eq("id", id);
          if (updateError) {
            results.push({ id, status: "failed", error: updateError.message });
            continue;
          }
          await writeAdminActionLog(admin, {
            ...actor,
            action: "set_inactive",
            entity_id: id,
            prev_status: p.status,
            new_status: "approved",
            metadata: { active: false },
          });
        } else if (action === "delete") {
          const { error: deleteError } = await admin.from("products").delete().eq("id", id);
          if (deleteError) {
            results.push({ id, status: "failed", error: deleteError.message });
            continue;
          }
          await writeAdminActionLog(admin, {
            ...actor,
            action: "delete",
            entity_id: id,
            prev_status: p.status,
            new_status: null,
          });
        }
        results.push({ id, status: "success" });
      } catch (e) {
        results.push({
          id,
          status: "failed",
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    revalidatePath("/admin/products");
    revalidatePath("/admin/products/queue");
    revalidatePath("/vendors/products");

    return NextResponse.json(
      { ok: true, results },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[admin/products/bulk] unexpected_error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
