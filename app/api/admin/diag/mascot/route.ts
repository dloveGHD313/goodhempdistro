import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getMascotFlagStatus } from "@/lib/mascotFlags";
import { getMascotLastError } from "@/lib/mascotDiagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    const flagStatus = getMascotFlagStatus();
    const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const openaiSearchModel =
      process.env.OPENAI_SEARCH_MODEL?.trim() || "gpt-4o-mini-search-preview";
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());
    const lastError = getMascotLastError();

    console.log(
      `[admin/diag/mascot] Admin ${adminCheck.user.id} checked mascot status. client=${flagStatus.clientEnabled} server=${flagStatus.serverEnabled}`
    );

    return NextResponse.json(
      {
        mascotEnabledClient: flagStatus.clientEnabled,
        mascotEnabledServer: flagStatus.serverEnabled,
        hasOpenAIKey,
        openaiModel,
        openaiSearchModel,
        runtime,
        lastError,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin/diag/mascot] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: errorMessage,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
