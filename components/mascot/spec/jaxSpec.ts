import type { MascotContext, MascotMood, MascotMove } from "../config";
import type { MascotUserRole } from "../context";

export type JaxPersona = "JAX_CONSUMER" | "JAX_VENDOR";

export const jaxSpec = {
  header: {
    title: "JAX Mascot AI",
    consumerSubtitle: "JAX • Community Concierge",
    vendorSubtitle: "JAX • Vendor Assistant",
  },
  personas: {
    JAX_CONSUMER: {
      name: "Jax",
      tagline: "Community concierge",
      avatarSources: [
        "/mascot/jax/consumer/idle.png",
        "/mascot/jax/idle.png",
        "/brand/goodhempdistrologo.png",
      ],
      microLinesByContext: {
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
      },
      blockedMoodLines: [
        "I'll keep this compliant and clear.",
        "Let's stay within the guidelines.",
        "I can help with safe, verified info.",
        "Keeping it compliant here.",
      ],
      signatureAcknowledgements: [
        "I'm hip.",
        "I'm hip - say less.",
        "I'm hip, let's go.",
        "I'm hip. One sec.",
      ],
      signatureClarifications: [
        "You hip?",
        "You hip so far?",
        "You hip with that?",
        "You hip, or want me to break it down?",
      ],
    },
    JAX_VENDOR: {
      name: "Jax",
      tagline: "Vendor ops support",
      avatarSources: [
        "/mascot/jax/vendor/idle.png",
        "/mascot/jax/idle.png",
        "/brand/goodhempdistrologo.png",
      ],
      microLinesByContext: {
        VENDOR: [
          "I'll guide you through the next step.",
          "Let's keep your listings compliant.",
          "Ready to move this forward.",
          "I can help with approvals and uploads.",
          "I'll keep it efficient and clear.",
        ],
        GENERIC: [
          "How can I support your business today?",
          "Ready when you are.",
          "Let's keep this moving.",
          "What's the top priority?",
          "I'll keep the next steps clear.",
        ],
      },
      blockedMoodLines: [
        "Let's keep this compliant and clear.",
        "I can help with verified, policy-safe steps.",
        "Staying within compliance here.",
        "I'll keep it professional and compliant.",
      ],
      signatureAcknowledgements: [],
      signatureClarifications: [],
    },
  },
  signatureCooldown: {
    min: 3,
    max: 5,
  },
  complianceNotes: [
    "No medical advice or dosage guidance.",
    "No illegal or bypass instructions.",
    "Guide users to compliant, verified flows only.",
  ],
  slangBlockedMoods: ["ERROR", "BLOCKED", "COMPLIANCE", "LEGAL", "URGENT"] as MascotMood[],
  moodMoves: {
    CHILL: "idle_bounce",
    FOCUSED: "focused_lean",
    EDUCATIONAL: "focused_lean",
    URGENT: "attention_pop",
    SUCCESS: "success_nod",
    ERROR: "error_shake",
    BLOCKED: "blocked_stop",
    COMPLIANCE: "focused_lean",
    LEGAL: "focused_lean",
  } satisfies Record<MascotMood, MascotMove>,
  personaByContext: {
    FEED: "JAX_CONSUMER",
    SHOP: "JAX_CONSUMER",
    EVENTS: "JAX_CONSUMER",
    VENDOR: "JAX_VENDOR",
    DELIVERY_DRIVER: "JAX_CONSUMER",
    B2B_LOGISTICS: "JAX_CONSUMER",
    GENERIC: "JAX_CONSUMER",
  } satisfies Record<MascotContext, JaxPersona>,
} as const;

export function getJaxPersona(context: MascotContext, role: MascotUserRole): JaxPersona {
  if (role.isVendor || role.isAdmin || context === "VENDOR") {
    return "JAX_VENDOR";
  }
  return jaxSpec.personaByContext[context] || "JAX_CONSUMER";
}

export function getJaxAvatarSources(persona: JaxPersona) {
  return jaxSpec.personas[persona].avatarSources;
}
