// Shared row reconstruction for the CSV/GPX export workers. Frames arrive
// either as the original nested array (chunks of frames) or as a flat
// Float64Array (rowCount × rowLength) transferred zero-copy from the exporter.

export type ExportRow = ArrayLike<number | null>;

export interface FramesPayload {
  frames?: (number | null)[][][];
  flat?: Float64Array;
  rowLength?: number;
  rowCount?: number;
}

export function getExportRows(data: FramesPayload): ExportRow[] {
  if (data.flat) {
    const flat = data.flat;
    const rowLength = data.rowLength ?? 0;
    const rowCount = data.rowCount ?? 0;
    const rows: ExportRow[] = new Array(rowCount);
    for (let r = 0; r < rowCount; r++) {
      rows[r] = flat.subarray(r * rowLength, (r + 1) * rowLength);
    }
    return rows;
  }
  return (data.frames ?? []).flat();
}
