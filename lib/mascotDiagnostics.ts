export type MascotLastError = {
  name: string;
  message: string;
  status?: number;
  at: string;
};

let lastMascotError: MascotLastError | null = null;

export function setMascotLastError(error: MascotLastError | null) {
  lastMascotError = error;
}

export function getMascotLastError() {
  return lastMascotError;
}
