import type { MascotContext, MascotId, MascotMood } from "./config";
import { jaxSpec, type JaxPersona } from "./spec/jaxSpec";

export const ledgerLines = [
  "Compliance comes first.",
  "Let's get your listing clean.",
  "This helps approval.",
  "Short steps, clean results.",
  "I'll guide you through it.",
];

export const milesLines = [
  "Route confirmed.",
  "Next stop queued.",
  "Let's keep it moving.",
  "Status ready to update.",
  "All deliveries in view.",
];

export const atlasLines = [
  "Documentation matters.",
  "Chain of custody stays clean.",
  "Load details ready.",
  "Confirm pickup and drop.",
  "Proceed with verified info.",
];

const slugify = (value: string) => value.toLowerCase().replace(/\s+/g, "_");

export type MicroLineInput = {
  mascot: MascotId;
  context: MascotContext;
  mood: MascotMood;
  allowSignature: boolean;
  signatureMode?: "ack" | "clarify";
  previousSignatureAt: number | null;
  messageIndex: number;
  persona?: JaxPersona;
};

export type MicroLineOutput = {
  line: string | null;
  nextSignatureAt: number | null;
};

const pickFrom = (lines: readonly string[], seed: number) => {
  if (!lines.length) return null;
  const index = seed % lines.length;
  return lines[index];
};

export function pickMicroLine({
  mascot,
  context,
  mood,
  allowSignature,
  signatureMode,
  previousSignatureAt,
  messageIndex,
  persona,
}: MicroLineInput): MicroLineOutput {
  const blockedMoods = new Set(jaxSpec.slangBlockedMoods);
  const jaxPersona = persona ?? "JAX_CONSUMER";
  const jaxPersonaSpec = jaxSpec.personas[jaxPersona];
  const canUseSignature =
    mascot === "JAX" &&
    allowSignature &&
    !blockedMoods.has(mood) &&
    jaxPersona === "JAX_CONSUMER" &&
    (previousSignatureAt === null || messageIndex >= previousSignatureAt);

  if (canUseSignature) {
    const pool =
      signatureMode === "clarify"
        ? jaxPersonaSpec.signatureClarifications
        : jaxPersonaSpec.signatureAcknowledgements;
    const cooldownSpan = jaxSpec.signatureCooldown.max - jaxSpec.signatureCooldown.min + 1;
    const nextCooldown = jaxSpec.signatureCooldown.min + (messageIndex % cooldownSpan);
    return {
      line: pickFrom(pool, messageIndex) || null,
      nextSignatureAt: messageIndex + nextCooldown,
    };
  }

  let lines: readonly string[] = [];
  if (mascot === "LEDGER") {
    lines = ledgerLines;
  } else if (mascot === "MILES") {
    lines = milesLines;
  } else if (mascot === "ATLAS") {
    lines = atlasLines;
  } else if (blockedMoods.has(mood)) {
    lines = jaxPersonaSpec.blockedMoodLines;
  } else {
    const lineMap = jaxPersonaSpec.microLinesByContext;
    const key = (context in lineMap ? context : "GENERIC") as keyof typeof lineMap;
    lines = lineMap[key] || lineMap.GENERIC;
  }

  const seed = Number.parseInt(slugify(`${context}-${mood}-${messageIndex}`), 36);
  return { line: pickFrom(lines, Number.isNaN(seed) ? messageIndex : seed), nextSignatureAt: null };
}
