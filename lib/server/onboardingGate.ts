import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";

type GateResult = { allow: true } | { redirectTo: string };

type ProfileRow = {
  id: string;
  role: string | null;
  vendor_status: string | null;
  consumer_onboarding_completed: boolean | null;
};

type VendorRow = {
  id: string;
  owner_user_id: string;
  vendor_onboarding_completed: boolean | null;
  terms_accepted_at: string | null;
  compliance_acknowledged_at: string | null;
};

const isDev = process.env.NODE_ENV !== "production";
type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const logDev = (message: string, detail?: Record<string, unknown>) => {
  if (!isDev) return;
  if (detail) {
    console.debug(`[onboardingGate] ${message}`, detail);
    return;
  }
  console.debug(`[onboardingGate] ${message}`);
};

async function loadProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, consumer_onboarding_completed, vendor_status")
    .eq("id", userId)
    .maybeSingle();

  if (error && isDev) {
    console.debug("[onboardingGate] profile load failed", {
      code: error.code,
      message: error.message,
    });
  }

  return (data as ProfileRow | null) ?? null;
}

async function loadVendor(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("vendors")
    .select("id, owner_user_id, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error && isDev) {
    console.debug("[onboardingGate] vendor load failed", {
      code: error.code,
      message: error.message,
    });
  }

  return (data as VendorRow | null) ?? null;
}

export async function requireConsumerOnboarding(userId: string | null): Promise<GateResult> {
  const supabase = await createSupabaseServerClient();

  if (!userId) {
    logDev("redirect: login");
    return { redirectTo: "/login" };
  }

  const profile = await loadProfile(supabase, userId);
  const isAdmin = profile?.role === "admin";
  if (isAdmin) {
    return { allow: true };
  }

  const completed = !!profile?.consumer_onboarding_completed;
  if (!completed) {
    logDev("redirect: consumer onboarding", { userId });
    return { redirectTo: "/onboarding/consumer" };
  }

  return { allow: true };
}

export async function requireVendorOnboarding(userId: string | null): Promise<GateResult> {
  const supabase = await createSupabaseServerClient();

  if (!userId) {
    logDev("redirect: login");
    return { redirectTo: "/login" };
  }

  const profile = await loadProfile(supabase, userId);
  const isAdmin = profile?.role === "admin";
  if (isAdmin) {
    return { allow: true };
  }

  // SSOT: Vendor dashboard requires profiles.vendor_status === "active" (set only by Stripe webhook)
  if (profile?.vendor_status !== "active") {
    logDev("redirect: vendor status not active", { userId, vendor_status: profile?.vendor_status ?? null });
    // Has vendor record but not active -> choose plan
    const vendor = await loadVendor(supabase, userId);
    if (vendor && vendor.owner_user_id === userId) {
      return { redirectTo: "/vendors/activate" };
    }
    return { redirectTo: "/vendor-registration" };
  }

  const vendor = await loadVendor(supabase, userId);
  if (!vendor || vendor.owner_user_id !== userId) {
    logDev("redirect: vendor registration", { userId });
    return { redirectTo: "/vendor-registration" };
  }

  const isComplete = !!vendor.vendor_onboarding_completed
    && !!vendor.terms_accepted_at
    && !!vendor.compliance_acknowledged_at;

  if (!isComplete) {
    logDev("redirect: vendor onboarding", { vendorId: vendor.id });
    return { redirectTo: "/onboarding/vendor" };
  }

  return { allow: true };
}
