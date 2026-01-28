type MascotFlagStatus = {
  clientEnabled: boolean;
  serverEnabled: boolean;
  clientFlagSource: "NEXT_PUBLIC_MASCOT_ENABLED" | "NEXT_PUBLIC_MASCOT_AI_ENABLED" | null;
  serverFlagSource: "MASCOT_AI_ENABLED" | "MASCOT_ENABLED" | null;
};

const getTrimmed = (value?: string) => (value ?? "").trim();

export function getMascotFlagStatus(): MascotFlagStatus {
  const publicFlag = getTrimmed(process.env.NEXT_PUBLIC_MASCOT_ENABLED);
  const publicCompatFlag = getTrimmed(process.env.NEXT_PUBLIC_MASCOT_AI_ENABLED);
  const serverFlag = getTrimmed(process.env.MASCOT_AI_ENABLED);
  const serverCompatFlag = getTrimmed(process.env.MASCOT_ENABLED);

  return {
    clientEnabled: publicFlag === "true" || publicCompatFlag === "true",
    serverEnabled: serverFlag === "true" || serverCompatFlag === "true",
    clientFlagSource: publicFlag
      ? "NEXT_PUBLIC_MASCOT_ENABLED"
      : publicCompatFlag
        ? "NEXT_PUBLIC_MASCOT_AI_ENABLED"
        : null,
    serverFlagSource: serverFlag ? "MASCOT_AI_ENABLED" : serverCompatFlag ? "MASCOT_ENABLED" : null,
  };
}

export function logMascotFlagMismatch(context: string, status = getMascotFlagStatus()) {
  if ((status.clientEnabled || status.serverEnabled) && status.clientEnabled !== status.serverEnabled) {
    console.warn(
      `[mascot-flags] ${context} mismatch clientEnabled=${status.clientEnabled} serverEnabled=${status.serverEnabled}`
    );
  }

  return status;
}
