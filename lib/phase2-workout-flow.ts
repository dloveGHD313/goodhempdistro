/**
 * Phase 2: Workout Flow — guided path selection and routing.
 * Persisted in localStorage; no backend schema.
 */

const KEY = "ghd_phase2_workout_flow";

export type WorkoutPath = "shopper" | "vendor" | "logistics" | "builder" | "affiliate" | "education";

/** Start flow UI can show "events" and "service_provider" tiles; both map to vendor for signup. */
export type StartPathId = WorkoutPath | "events" | "service_provider";

export type WorkoutFlowState = {
  selectedPath: StartPathId | null;
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
    const path = parsed.selectedPath as StartPathId | null;
    const validPaths: StartPathId[] = ["shopper", "vendor", "logistics", "builder", "affiliate", "education", "events", "service_provider"];
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
  education: "/education",
};

/** Redirect when "Sign me up, then take me there" (events + service_provider → vendor registration). */
export function getRedirectForStartPath(selectedPath: string | null | undefined): string {
  if (selectedPath === "events" || selectedPath === "service_provider") return "/vendor-registration";
  return getDefaultRouteForUser({ workoutPath: selectedPath ?? undefined });
}

/**
 * Public destination when "Continue without account".
 * Events → /events; service_provider → /discover (TODO: replace with /services when implemented).
 */
export function getPublicRedirectForStartPath(selectedPath: string | null | undefined): string {
  if (selectedPath === "events") return "/events";
  if (selectedPath === "service_provider") return "/discover"; // TODO: Replace with /services when implemented.
  return getRedirectForStartPath(selectedPath);
}

/** Resolve workout_path to persist / pass as role param (events + service_provider → vendor). */
export function getEffectiveWorkoutPath(selectedPath: string | null | undefined): WorkoutPath {
  if (selectedPath === "events" || selectedPath === "service_provider") return "vendor";
  if (isValidWorkoutPath(selectedPath)) return selectedPath;
  return "shopper";
}

/** Type guard: true if path is a valid workout path key. */
export function isValidWorkoutPath(path: string | null | undefined): path is WorkoutPath {
  return typeof path === "string" && path.length > 0 && Object.prototype.hasOwnProperty.call(WORKOUT_REDIRECTS, path);
}

export type GetDefaultRouteForUserOpts = {
  accountRole?: string | null;
  workoutPath?: string | null;
};

/**
 * Default route for logged-in home redirect.
 * Priority: workout_path (Start flow) => account role (admin => /dashboard) => /discover.
 */
export function getDefaultRouteForUser(opts: GetDefaultRouteForUserOpts): string {
  const { accountRole, workoutPath } = opts;
  if (isValidWorkoutPath(workoutPath)) {
    return WORKOUT_REDIRECTS[workoutPath];
  }
  if (accountRole === "admin") {
    return "/dashboard";
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
