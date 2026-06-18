// Type shims for plain-JS modules ported verbatim from the JS reference implementation.
// These modules have no TypeScript declarations; the shims provide minimal types
// so that vue-tsc does not flag implicit-any imports. The actual runtime types are
// validated by the test suite (24 acro1 gates + unit tests).
declare module './mag_model.js' {
  export function loadMagCharacterizationModel(
    model: Record<string, unknown>,
  ): Record<string, unknown>;
}
declare module './mag_correction.js' {
  export function correctMagToBody(
    magRaw: number[],
    model: Record<string, unknown>,
  ): Record<string, unknown>;
}
declare module './mag_alignment.js' {
  // Not directly imported by TS consumers; used internally by mag_correction.js
}
