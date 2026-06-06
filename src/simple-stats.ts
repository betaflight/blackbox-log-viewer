import type { FlightLog } from "./flightlog";

interface FieldStat {
  name: string;
  min: number;
  max: number;
  mean: number;
}

export function SimpleStats(flightLog: FlightLog) {
  // getMinTime/getMaxTime are `number | false` (false until P/I frames are
  // parsed). Only query a real time range; otherwise there is no data, so the
  // stats short-circuit to empty via the !frames.length guard below.
  const minTime = flightLog.getMinTime();
  const maxTime = flightLog.getMaxTime();
  const chunks =
    minTime === false || maxTime === false
      ? []
      : flightLog.getChunksInTimeRange(minTime, maxTime);
  const frames = chunks.flatMap((chunk) => chunk.frames);
  const fields = flightLog
    .getMainFieldNames()
    .map((f) => (f === "BaroAlt" ? "baroAlt" : f));

  const getMinMaxMean = (fieldName: string): FieldStat | undefined => {
    const index = fields.indexOf(fieldName);
    if (
      index === -1 ||
      !frames.length ||
      !(index in frames[0]) ||
      !frames[index][index]
    ) {
      return undefined;
    }
    let min = Infinity,
      max = -Infinity,
      sum = 0;
    for (const f of frames) {
      const v = f[index];
      if (v < min) {
        min = v;
      }
      if (v > max) {
        max = v;
      }
      sum += v;
    }
    return {
      name: fieldName,
      min,
      max,
      mean: sum / frames.length,
    };
  };

  const template = {
    roll: () => getMinMaxMean("rcCommand[0]"),
    pitch: () => getMinMaxMean("rcCommand[1]"),
    yaw: () => getMinMaxMean("rcCommand[2]"),
    throttle: () => getMinMaxMean("rcCommand[3]"),
    vbat: () => getMinMaxMean("vbatLatest"),
    amps: () => getMinMaxMean("amperageLatest"),
    rssi: () => getMinMaxMean("rssi"),
    alt_baro: () => getMinMaxMean("baroAlt"),
    alt_gps: () => getMinMaxMean("GPS_altitude"),
  };

  function calculate() {
    return Object.fromEntries(
      Object.entries(template).map(([key, fn]) => [key, fn()]),
    );
  }

  return {
    calculate: calculate,
  };
}
