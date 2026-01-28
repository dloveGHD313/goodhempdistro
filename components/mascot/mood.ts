import type { MascotMood, MascotMove } from "./config";

export const moodMoves: Record<MascotMood, MascotMove> = {
  CHILL: "idle_bounce",
  FOCUSED: "focused_lean",
  EDUCATIONAL: "focused_lean",
  URGENT: "attention_pop",
  SUCCESS: "success_nod",
  ERROR: "error_shake",
  BLOCKED: "blocked_stop",
  COMPLIANCE: "focused_lean",
  LEGAL: "focused_lean",
};

export function getMoveForMood(mood: MascotMood): MascotMove {
  return moodMoves[mood] || "idle_still";
}
