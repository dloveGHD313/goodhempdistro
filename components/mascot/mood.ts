import type { MascotMood, MascotMove } from "./config";
import { jaxSpec } from "./spec/jaxSpec";

export const moodMoves: Record<MascotMood, MascotMove> = jaxSpec.moodMoves;

export function getMoveForMood(mood: MascotMood): MascotMove {
  return moodMoves[mood] || "idle_still";
}
