import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";

export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export type VerificationSummary = {
  status: VerificationStatus;
  verificationId?: string;
  reviewedAt?: string | null;
};

export async function getUserVerificationStatus(
  userId: string | null
): Promise<VerificationSummary> {
  if (!userId) {
    return { status: "none" };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("id_verifications")
    .select("id, status, reviewed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { status: "none" };
  }

  const normalized =
    data.status === "verified" ? "approved" : (data.status as VerificationStatus);

  if (!["pending", "approved", "rejected"].includes(normalized)) {
    return { status: "pending", verificationId: data.id, reviewedAt: data.reviewed_at };
  }

  return {
    status: normalized as VerificationStatus,
    verificationId: data.id,
    reviewedAt: data.reviewed_at,
  };
}

type RequireResult =
  | { ok: true; status: VerificationStatus }
  | {
      ok: false;
      status: number;
      code: "ID_VERIFICATION_REQUIRED";
      message: string;
      redirectTo: string;
    };

export async function require21Plus(
  userId: string | null,
  redirectTo = "/verify-age"
): Promise<RequireResult> {
  const summary = await getUserVerificationStatus(userId);
  if (summary.status === "approved") {
    return { ok: true, status: summary.status };
  }

  return {
    ok: false,
    status: 403,
    code: "ID_VERIFICATION_REQUIRED",
    message: "21+ verification is required to access gated products.",
    redirectTo,
  };
}
