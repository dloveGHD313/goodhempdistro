import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const logStage = (stage: string, details?: Record<string, unknown>) => {
    console.log(`[admin/inquiries][${requestId}] ${stage}`, details || {});
  };
  try {
    logStage("start");
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      logStage("auth_missing", { reason: adminCheck.reason });
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!adminCheck.isAdmin) {
      logStage("auth_forbidden", { userId: adminCheck.user.id, reason: adminCheck.reason });
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createSupabaseAdminClient();
    const fullSelect = `
      id,
      service_id,
      vendor_id,
      owner_user_id,
      requester_name,
      requester_email,
      requester_phone,
      message,
      status,
      vendor_note,
      created_at,
      updated_at,
      services!service_inquiries_service_id_fkey(
        id,
        name,
        title,
        slug
      ),
      vendors!service_inquiries_vendor_id_fkey(
        id,
        business_name,
        owner_user_id
      )
    `;
    const fallbackSelect = `
      id,
      service_id,
      vendor_id,
      owner_user_id,
      requester_name,
      requester_email,
      requester_phone,
      message,
      created_at,
      updated_at,
      services!service_inquiries_service_id_fkey(
        id,
        name,
        title,
        slug
      ),
      vendors!service_inquiries_vendor_id_fkey(
        id,
        business_name,
        owner_user_id
      )
    `;

    const fetchInquiries = async (select: string) =>
      admin.from("service_inquiries").select(select).order("created_at", { ascending: false });

    let inquiries: any[] | null = null;
    let error: any = null;
    const firstAttempt = await fetchInquiries(fullSelect);
    inquiries = firstAttempt.data;
    error = firstAttempt.error;

    if (error) {
      const message = String(error.message || "");
      const isMissingColumn =
        message.includes("column") && message.includes("does not exist");
      if (isMissingColumn) {
        logStage("schema_fallback", { reason: message });
        const fallbackAttempt = await fetchInquiries(fallbackSelect);
        inquiries = fallbackAttempt.data;
        error = fallbackAttempt.error;
      }
    }

    if (error) {
      console.error(`[admin/inquiries][${requestId}] list_error`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { ok: false, error: "Failed to fetch inquiries", message: error.message, details: error.details, hint: error.hint },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const normalized = (inquiries || []).map((inq: any) => {
      const hasStatusKey = Object.prototype.hasOwnProperty.call(inq, "status");
      return {
        ...inq,
        status: hasStatusKey ? inq.status : "new",
        services: Array.isArray(inq.services) ? inq.services[0] : inq.services || null,
        vendors: Array.isArray(inq.vendors) ? inq.vendors[0] : inq.vendors || null,
      };
    });

    logStage("success", { items: normalized.length });
    logStage("diagnostic", {
      count: normalized.length,
      statusKeyInFirst: normalized[0]
        ? Object.prototype.hasOwnProperty.call(normalized[0], "status")
        : false,
    });
    return NextResponse.json(
      { ok: true, data: normalized },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[admin/inquiries][${requestId}] unexpected_error`, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
