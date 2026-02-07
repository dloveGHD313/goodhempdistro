/**
 * Lightweight client telemetry helper.
 * Logs to console (dev + prod). No DB or external service.
 * Use for onboarding submit success/failure and other client events.
 */
export function logEvent(name: string, payload?: Record<string, unknown>): void {
  const entry = {
    event: name,
    ts: new Date().toISOString(),
    ...payload,
  };
  if (typeof window !== "undefined") {
    console.log("[telemetry]", JSON.stringify(entry));
  }
}
