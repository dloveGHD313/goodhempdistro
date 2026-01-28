type MascotFlagStatus = {
  clientEnabled: boolean;
  serverEnabled: boolean;
  clientFlagSource: "NEXT_PUBLIC_MASCOT_ENABLED" | null;
  serverFlagSource: "MASCOT_AI_ENABLED" | null;
};

const getTrimmed = (value?: string) => (value ?? "").trim();

export function getMascotFlagStatus(): MascotFlagStatus {
  const publicFlag = getTrimmed(process.env.NEXT_PUBLIC_MASCOT_ENABLED);
  const serverFlag = getTrimmed(process.env.MASCOT_AI_ENABLED);

  return {
    clientEnabled: publicFlag === "true",
    serverEnabled: serverFlag === "true",
    clientFlagSource: publicFlag ? "NEXT_PUBLIC_MASCOT_ENABLED" : null,
    serverFlagSource: serverFlag ? "MASCOT_AI_ENABLED" : null,
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
