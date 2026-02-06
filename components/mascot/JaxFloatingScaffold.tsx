"use client";

import dynamic from "next/dynamic";

const MascotMount = dynamic(() => import("./MascotMount"), { ssr: false });

/**
 * Phase 0: Persistent JAX floating widget scaffold.
 * Shown on /welcome (public) and all authenticated pages via root layout.
 * Gating: unauthenticated users see the widget; full AI gating is handled by the mascot-chat API.
 */
export default function JaxFloatingScaffold() {
  return (
    <div data-phase0="jax-scaffold" aria-label="Ask JAX assistant">
      <MascotMount />
    </div>
  );
}
