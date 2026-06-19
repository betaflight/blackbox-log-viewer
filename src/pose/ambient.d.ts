// Type shims for plain-JS modules that have paired .d.ts declaration files.
// The paired files (mag_model.d.ts, mag_correction.d.ts) are the authoritative
// type definitions; this file only covers modules without standalone .d.ts files.
declare module './mag_alignment.js' {
  // Not directly imported by TS consumers; used internally by mag_correction.js
}
