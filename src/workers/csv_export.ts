import { getExportRows, type ExportRow, type FramesPayload } from "./export_rows";

export interface CsvExportPayload extends FramesPayload {
  opts: {
    columnDelimiter: string;
    stringDelimiter: string;
    quoteStrings: boolean;
  };
  fieldNames: string[];
  sysConfig: Record<string, unknown>;
}

// Pure CSV serialization (no worker globals), so it is unit/golden-testable.
export function buildCsv(data: CsvExportPayload): string {
  const opts = data.opts;
  const stringDelim = opts.quoteStrings ? opts.stringDelimiter : "";

  // Converts null / empty non-numeric values to an empty string.
  const normalizeEmpty = (value: unknown): string => (value ? String(value) : "");

  const joinColumns = (columns: unknown[]): string =>
    columns
      .map((value) =>
        typeof value === "number"
          ? value
          : `${stringDelim}${normalizeEmpty(value)}${stringDelim}`,
      )
      .join(opts.columnDelimiter);

  // Converts null / empty non-numeric values to the string "NaN".
  const joinColumnValues = (columns: ExportRow): string => {
    let row = "";
    for (let i = 0; i < columns.length; i++) {
      if (i > 0) {
        row += opts.columnDelimiter;
      }
      const value = columns[i];
      row += typeof value === "number" || value ? String(value) : "NaN";
    }
    return row;
  };

  const mainFields = [joinColumns(data.fieldNames)]
    .concat(getExportRows(data).map((row) => joinColumnValues(row)))
    .join("\n");
  const headers = Object.entries(data.sysConfig)
    .map(([key, value]) => joinColumns([key, value]))
    .join("\n");

  return `${headers}\n${mainFields}`;
}
