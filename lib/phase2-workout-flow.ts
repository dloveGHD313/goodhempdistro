/**
 * Phase 2: Workout Flow — guided path selection and routing.
 * Persisted in localStorage; no backend schema.
 */

const KEY = "ghd_phase2_workout_flow";

export type WorkoutPath = "shopper" | "vendor" | "logistics" | "builder" | "affiliate";

export type WorkoutFlowState = {
  selectedPath: WorkoutPath | null;
  timestamp: string;
  lastStepCompleted: number;
};

function readRaw(): WorkoutFlowState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { selectedPath?: string; timestamp?: string; lastStepCompleted?: number };
    if (!parsed || typeof parsed.lastStepCompleted !== "number") return null;
    const path = parsed.selectedPath as WorkoutPath | null;
    const validPaths: WorkoutPath[] = ["shopper", "vendor", "logistics", "builder", "affiliate"];
    return {
      selectedPath: path && validPaths.includes(path) ? path : null,
      timestamp: typeof parsed.timestamp === "string" ? parsed.timestamp : new Date().toISOString(),
      lastStepCompleted: parsed.lastStepCompleted,
    };
  } catch {
    return null;
  }
}

/** Get stored workout flow state. Hydration-safe. */
export function getWorkoutFlowState(): WorkoutFlowState | null {
  return readRaw();
}

/** Persist workout flow state. */
export function setWorkoutFlowState(patch: Partial<WorkoutFlowState>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readRaw();
    const now = new Date().toISOString();
    const next: WorkoutFlowState = {
      selectedPath: patch.selectedPath ?? existing?.selectedPath ?? null,
      timestamp: patch.timestamp ?? existing?.timestamp ?? now,
      lastStepCompleted: patch.lastStepCompleted ?? existing?.lastStepCompleted ?? 0,
    };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** Clear workout flow state. */
export function clearWorkoutFlowState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Redirect destination for each path (used after flow completion). */
export const WORKOUT_REDIRECTS: Record<WorkoutPath, string> = {
  shopper: "/discover",
  vendor: "/vendor-registration",
  logistics: "/logistics/apply",
  builder: "/services",
  affiliate: "/affiliate",
};

/** Default route for a stored profile role (used for logged-in home redirect). */
export function getDefaultRouteForRole(role?: string | null): string {
  if (!role) return "/discover";
  if (role in WORKOUT_REDIRECTS) {
    return WORKOUT_REDIRECTS[role as WorkoutPath];
  }
  return "/discover";
}

const MAX_NEXT_LENGTH = 2048;

/**
 * Validates that `next` is a safe internal path (no open redirect).
 * Must be string, start with "/", not "//", no protocol, no newlines, reasonable length.
 */
export function isSafeNextPath(next: string | null | undefined): next is string {
  if (typeof next !== "string") return false;
  if (next.length === 0 || next.length > MAX_NEXT_LENGTH) return false;
  if (!next.startsWith("/") || next.startsWith("//")) return false;
  if (next.includes("http://") || next.includes("https://")) return false;
  if (next.includes("\n") || next.includes("\r")) return false;
  return true;
}

/**
 * Returns a safe redirect path: `next` if valid, otherwise `fallback`.
 */
export function sanitizeNextPath(next: string | null | undefined, fallback: string): string {
  return isSafeNextPath(next) ? next : fallback;
}
