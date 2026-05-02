import { getMascotFlagStatus } from "@/lib/mascotFlags";
import JaxFloatingScaffold from "./JaxFloatingScaffold";

/**
 * Build 10 revision: widget visible to ALL users (paid, free, unauthed).
 * Plan-based gating happens at click time inside MascotWidget so free
 * users see a tiered upgrade UI in the panel rather than no widget at all.
 *
 * Layered kill-switches still apply:
 *   1. NEXT_PUBLIC_MASCOT_ENABLED (client)
 *   2. MASCOT_AI_ENABLED (server)
 *
 * Note: this restores root layout to mostly-static rendering — the
 * auth check that used to live here was the cause of the previous
 * dynamic-render side effect.
 */
export default function MascotGate() {
  const { clientEnabled, serverEnabled } = getMascotFlagStatus();
  if (!clientEnabled || !serverEnabled) return null;
  return <JaxFloatingScaffold />;
}
