import { getMascotFlagStatus } from "@/lib/mascotFlags";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getJaxEligibility } from "@/lib/jax/eligibility";
import JaxFloatingScaffold from "./JaxFloatingScaffold";

/**
 * Build 10: paid-only Ask JAX gate.
 *
 * Layered checks (any false = render NOTHING):
 *   1. NEXT_PUBLIC_MASCOT_ENABLED (client kill-switch)
 *   2. MASCOT_AI_ENABLED (server kill-switch)
 *   3. User authenticated AND eligible (paid plan)
 *
 * Note: this component performs an auth lookup on every page render,
 * which forces the root layout to be dynamic. Marketing pages lose
 * static generation as a result. Documented as a known tradeoff.
 */
export default async function MascotGate() {
  const { clientEnabled, serverEnabled } = getMascotFlagStatus();
  if (!clientEnabled || !serverEnabled) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const eligibility = await getJaxEligibility(user.id, user.email ?? null);
    if (!eligibility.eligible) return null;
  } catch {
    return null;
  }

  return <JaxFloatingScaffold />;
}
