import type { FlightLog } from "./flightlog";

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
    const frames = flightLog
        .getChunksInTimeRange(
          flightLog.getMinTime() as number,
          flightLog.getMaxTime() as number,
        )
        .map((chunk) => chunk.frames),
      worker = new Worker("/js/webworkers/csv-export-worker.js");

    worker.onmessage = (event) => {
      success(event.data);
      worker.terminate();
    };
    worker.postMessage({
      sysConfig: flightLog.getSysConfig(),
      fieldNames: flightLog.getMainFieldNames(),
      frames: frames,
      opts: options,
    });
  }

  // exposed functions
  return {
    dump: dump,
  };
}
