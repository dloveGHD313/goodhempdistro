import type { MascotMood } from "@/components/mascot/config";

type SafetyResult = {
  blocked: boolean;
  mood: MascotMood;
  reply: string;
  suggestions: string[];
};

const contains = (text: string, patterns: string[]) =>
  patterns.some((pattern) => text.includes(pattern));

export function checkSafety(message: string): SafetyResult | null {
  const text = message.toLowerCase();

  if (
    contains(text, [
      "dose",
      "dosage",
      "mg",
      "medical",
      "treat",
      "cure",
      "prescription",
      "doctor",
      "diagnose",
    ])
  ) {
    return {
      blocked: true,
      mood: "COMPLIANCE",
      reply:
        "I can’t provide medical advice. I can share general product information and point you to compliance resources.",
      suggestions: ["Browse verified products", "Read compliance updates", "Contact support"],
    };
  }

  if (
    contains(text, [
      "illegal",
      "ship to",
      "bypass",
      "fake coa",
      "fraud",
      "evade",
      "unlicensed",
    ])
  ) {
    return {
      blocked: true,
      mood: "LEGAL",
      reply:
        "I can’t help with anything illegal or non-compliant. I can guide you to approved listings and compliance help.",
      suggestions: ["See compliance basics", "Find approved vendors", "Support contact"],
    };
  }

  return null;
}
