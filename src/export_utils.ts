import { triggerDownload } from "./tools.js";
import { CsvExporter } from "./csv-exporter.js";
import { GpxExporter } from "./gpx-exporter.js";
import type { FlightLog } from "./flightlog";

function createExportCallback(
  fileExtension: string,
  fileType: string,
  file: string | null | undefined,
  startTime: number,
  logFilename: string,
) {
  return function (data: unknown) {
    console.debug(
      `${fileExtension.toUpperCase()} export finished in ${
        (performance.now() - startTime) / 1000
      } secs`,
    );
    if (!data) {
      console.debug("Empty data, nothing to save");
      return;
    }
    const filename = file || `${logFilename}.${fileExtension}`;
    triggerDownload(new Blob([data as BlobPart], { type: fileType }), filename);
  };
}

export function exportCsv(
  flightLog: FlightLog,
  logFilename: string,
  file?: string,
  options = {},
) {
  const onSuccess = createExportCallback(
    "csv",
    "text/csv",
    file,
    performance.now(),
    logFilename,
  );
  CsvExporter(flightLog, options).dump(onSuccess);
}

export function exportGpx(
  flightLog: FlightLog,
  logFilename: string,
  file?: string,
) {
  const onSuccess = createExportCallback(
    "gpx",
    "application/gpx+xml",
    file,
    performance.now(),
    logFilename,
  );
  GpxExporter(flightLog).dump(onSuccess);
}

// The spectrum analyser is still JS; describe only what's used here.
interface SpectrumAnalyser {
  getExportedFileName(): string | null;
  exportSpectrumToCSV(
    onSuccess: (data: unknown) => void,
    options: object,
  ): void;
}

export function exportSpectrumToCsv(
  analyser: SpectrumAnalyser,
  logFilename: string,
  options = {},
) {
  const fileName = analyser.getExportedFileName();
  if (fileName == null) {
    console.warn("The export is not supported for this spectrum type");
    return;
  }

  const onSuccess = createExportCallback(
    "csv",
    "text/csv",
    fileName,
    performance.now(),
    logFilename,
  );
  analyser.exportSpectrumToCSV(onSuccess, options);
}
