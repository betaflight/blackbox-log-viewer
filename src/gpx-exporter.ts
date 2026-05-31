import type { FlightLog } from "./flightlog";

export function GpxExporter(flightLog: FlightLog) {
  function dump(success: (data: unknown) => void) {
    const frames = flightLog
        .getChunksInTimeRange(
          flightLog.getMinTime() as number,
          flightLog.getMaxTime() as number,
        )
        .map((chunk) => chunk.frames),
      worker = new Worker("/js/webworkers/gpx-export-worker.js");

    worker.onmessage = (event) => {
      success(event.data);
      worker.terminate();
    };
    worker.postMessage({
      sysConfig: flightLog.getSysConfig(),
      fieldNames: flightLog.getMainFieldNames(),
      frames: frames,
    });
  }

  // exposed functions
  return {
    dump: dump,
  };
}
