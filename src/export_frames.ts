// Helper for the CSV/GPX exporters: flatten the per-chunk frame arrays
// (chunks → frames → values) into a single transferable Float64Array so the
// export worker receives it via a zero-copy transfer instead of a synchronous
// structured clone of a deeply-nested `number[][][]` (the source of the
// multi-second main-thread freeze on large logs).
//
// `null`/`undefined` cells (produced by the slow/GPS frame merge) become NaN,
// which both workers already render identically to the original `null`
// (CSV → "NaN", GPX → falsy → skipped). Numeric values are unchanged.

export interface FlatFrames {
  flat: Float64Array;
  rowLength: number;
  rowCount: number;
}

/**
 * Flatten chunk frames into a transferable Float64Array. Returns `null` when
 * the frames are empty or ragged (non-uniform row width), so the caller can
 * fall back to posting the original nested array unchanged.
 */
export function flattenFrames(chunkFrames: number[][][]): FlatFrames | null {
  let rowCount = 0;
  let rowLength = -1;
  for (const chunk of chunkFrames) {
    for (const frame of chunk) {
      if (rowLength === -1) {
        rowLength = frame.length;
      } else if (frame.length !== rowLength) {
        return null; // ragged — let the caller use the nested fallback
      }
      rowCount++;
    }
  }
  if (rowCount === 0 || rowLength <= 0) {
    return null;
  }

  const flat = new Float64Array(rowCount * rowLength);
  let i = 0;
  for (const chunk of chunkFrames) {
    for (const frame of chunk) {
      for (let c = 0; c < rowLength; c++) {
        const v = frame[c];
        flat[i++] = v == null ? NaN : v;
      }
    }
  }
  return { flat, rowLength, rowCount };
}
