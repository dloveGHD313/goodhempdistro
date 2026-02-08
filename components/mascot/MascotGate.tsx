import { getMascotFlagStatus } from "@/lib/mascotFlags";
import JaxFloatingScaffold from "./JaxFloatingScaffold";

/**
 * Server-only gate for the global mascot.
 * Renders JaxFloatingScaffold only when BOTH are true:
 * - NEXT_PUBLIC_MASCOT_ENABLED (client/public)
 * - MASCOT_AI_ENABLED (server)
 * This keeps gating deterministic and avoids client-side hook-order issues.
 */
export default function MascotGate() {
  const { clientEnabled, serverEnabled } = getMascotFlagStatus();
  if (!clientEnabled || !serverEnabled) {
    return null;
  }
  return <JaxFloatingScaffold />;
}
