// Golden-file characterization test for FlightLog — the layer above the parser
// that builds chunks and injects the computed fields (attitude via IMU, PID
// sum/error, RC-command scaling, GPS coord/distance/azimuth via GpsTransform).
//
// The parser golden covers FlightLogParser; this covers FlightLog's
// computed-field pipeline (and transitively imu.ts + gps_transform.ts), which
// is otherwise untested. Values are rounded to 4 decimals so the snapshot is
// stable and readable while still catching any logic change.
//
//   npm run test:flightlog
//   npm run test:flightlog -- --update
import { readFileSync, writeFileSync } from "node:fs";
import { FlightLog } from "../src/flightlog.js";
import { buildSyntheticLog, buildComplexLog } from "./fixtures/synthetic_log.js";

const CASES = [
  { name: "simple", build: buildSyntheticLog, golden: "test/fixtures/flightlog.golden.json" },
  { name: "complex", build: buildComplexLog, golden: "test/fixtures/flightlog.golden.complex.json" },
];

function round(v) {
  return v == null || Number.isNaN(v) ? null : Math.round(v * 10000) / 10000;
}

function snapshot(logData) {
  const fl = new FlightLog(logData);
  if (!fl.openLog(0)) {
    throw new Error("openLog(0) failed for the synthetic log");
  }
  const minTime = fl.getMinTime();
  const maxTime = fl.getMaxTime();
  const chunks =
    minTime === false || maxTime === false
      ? []
      : fl.getChunksInTimeRange(minTime, maxTime);
  const frames = chunks
    .flatMap((c) => c.frames)
    .map((f) => Array.from(f, round));

  return {
    minTime,
    maxTime,
    numMotors: fl.getNumMotors(),
    numCellsEstimate: fl.getNumCellsEstimate(),
    hasGpsData: fl.hasGpsData(),
    fieldNames: fl.getMainFieldNames(),
    frameCount: frames.length,
    frames,
  };
}

const update = process.argv.includes("--update");
let failures = 0;

for (const c of CASES) {
  const actual = `${JSON.stringify(snapshot(c.build()), null, 2)}\n`;

  if (update) {
    writeFileSync(c.golden, actual);
    console.log(`updated ${c.name}: ${c.golden}`);
    continue;
  }

  let expected;
  try {
    expected = readFileSync(c.golden, "utf8");
  } catch {
    console.error(`Missing golden ${c.golden}. Run: npm run test:flightlog -- --update`);
    failures++;
    continue;
  }

  if (actual === expected) {
    console.log(`ok   ${c.name} flightlog golden matches`);
    continue;
  }

  failures++;
  const a = actual.split("\n");
  const e = expected.split("\n");
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    if (a[i] !== e[i]) {
      console.error(`FAIL ${c.name} differs at line ${i + 1}:`);
      console.error(`  expected: ${e[i] ?? "<eof>"}`);
      console.error(`  actual:   ${a[i] ?? "<eof>"}`);
      break;
    }
  }
}

process.exit(update ? 0 : failures === 0 ? 0 : 1);
