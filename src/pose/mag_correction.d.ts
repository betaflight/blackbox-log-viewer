export function correctMagToBody(
  magRaw: [number, number, number],
  model: Record<string, unknown>,
): {
  mBody: [number, number, number];
  gaussPerCorrectedUnit: number;
} | null;
