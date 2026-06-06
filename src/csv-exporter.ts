import type { FlightLog } from "./flightlog";
import { flattenFrames } from "./export_frames";

export interface CsvExportOptions {
  columnDelimiter: string;
  stringDelimiter: string;
  quoteStrings: boolean;
}

export function CsvExporter(
  flightLog: FlightLog,
  opts: Partial<CsvExportOptions> = {},
) {
  const options: CsvExportOptions = {
    columnDelimiter: ",",
    stringDelimiter: '"',
    quoteStrings: true,
    ...opts,
  };

  function dump(success: (data: unknown) => void) {
    const minTime = flightLog.getMinTime();
    const maxTime = flightLog.getMaxTime();
    const frames =
      minTime === false || maxTime === false
        ? []
        : flightLog
            .getChunksInTimeRange(minTime, maxTime)
            .map((chunk) => chunk.frames);
    const worker = new Worker(
      new URL("./workers/csv-export-worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event) => {
      success(event.data);
      worker.terminate();
    };

    const base = {
      sysConfig: flightLog.getSysConfig(),
      fieldNames: flightLog.getMainFieldNames(),
      opts: options,
    };
    // Transfer a flattened Float64Array (zero-copy) instead of structure-cloning
    // the nested frames; fall back to the nested array when it can't be flattened.
    const flat = flattenFrames(frames);
    if (flat) {
      worker.postMessage(
        { ...base, flat: flat.flat, rowLength: flat.rowLength, rowCount: flat.rowCount },
        [flat.flat.buffer],
      );
    } else {
      worker.postMessage({ ...base, frames });
    }
  }

  // exposed functions
  return {
    dump: dump,
  };
}
