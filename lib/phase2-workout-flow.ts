/**
 * Phase 2: Workout Flow — guided path selection and routing.
 * Persisted in localStorage; no backend schema.
 */

const KEY = "ghd_phase2_workout_flow";

export type WorkoutPath = "shopper" | "vendor" | "logistics" | "builder";

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
    const validPaths: WorkoutPath[] = ["shopper", "vendor", "logistics", "builder"];
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
};
