import type { MascotContext, MascotId, MascotMood } from "./config";

export const jaxContextLines: Record<
  Exclude<MascotContext, "VENDOR" | "DELIVERY_DRIVER" | "B2B_LOGISTICS">,
  string[]
> = {
  FEED: [
    "Searching the feed now.",
    "I'll pull the real posts.",
    "Let's see what people are saying.",
    "Receipts coming up.",
    "Feed don’t lie.",
  ],
  SHOP: [
    "Scanning the marketplace.",
    "Let's find the legit stuff.",
    "Only real listings.",
    "No funny business.",
    "What are we hunting today?",
  ],
  EVENTS: [
    "Checking the calendar.",
    "Where we pulling up?",
    "Events coming right up.",
    "Let's see what's popping.",
    "I'll line it up for you.",
  ],
  GENERIC: [
    "Say less - I got you.",
    "No stress.",
    "Handled.",
    "Let's keep it simple.",
    "Point me where to look.",
  ],
};

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

export const jaxSignatureAcknowledgements = [
  "I'm hip.",
  "I'm hip - say less.",
  "I'm hip, let's go.",
  "I'm hip. One sec.",
];

export const jaxSignatureClarifications = [
  "You hip?",
  "You hip so far?",
  "You hip with that?",
  "You hip, or want me to break it down?",
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
};

export type MicroLineOutput = {
  line: string | null;
  nextSignatureAt: number | null;
};

const pickFrom = (lines: string[], seed: number) => {
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
}: MicroLineInput): MicroLineOutput {
  const blockedMoods = new Set(["ERROR", "BLOCKED", "COMPLIANCE", "LEGAL", "URGENT"]);
  const canUseSignature =
    mascot === "JAX" &&
    allowSignature &&
    !blockedMoods.has(mood) &&
    (previousSignatureAt === null || messageIndex >= previousSignatureAt);

  if (canUseSignature) {
    const pool =
      signatureMode === "clarify" ? jaxSignatureClarifications : jaxSignatureAcknowledgements;
    const nextCooldown = 3 + (messageIndex % 3);
    return {
      line: pickFrom(pool, messageIndex) || null,
      nextSignatureAt: messageIndex + nextCooldown,
    };
  }

  let lines: string[] = [];
  if (mascot === "LEDGER") {
    lines = ledgerLines;
  } else if (mascot === "MILES") {
    lines = milesLines;
  } else if (mascot === "ATLAS") {
    lines = atlasLines;
  } else {
    const key = (context === "FEED" ||
      context === "SHOP" ||
      context === "EVENTS" ||
      context === "GENERIC"
      ? context
      : "GENERIC") as keyof typeof jaxContextLines;
    lines = jaxContextLines[key] || jaxContextLines.GENERIC;
  }

  const seed = Number.parseInt(slugify(`${context}-${mood}-${messageIndex}`), 36);
  return { line: pickFrom(lines, Number.isNaN(seed) ? messageIndex : seed), nextSignatureAt: null };
}
