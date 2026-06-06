// Golden-file characterization test for the CSV/GPX/spectrum export workers.
//
// Locks the export OUTPUT FORMAT against committed snapshots and proves the two
// CSV/GPX postMessage protocols are equivalent: the original nested frames
// array and the flattened transferable Float64Array (the export perf
// optimisation). Also unit-checks the real `flattenFrames` helper.
//
// The worker entries are thin shells around these pure serializers, so the test
// imports the real logic directly — no worker sandbox needed.
//
//   npm run test:export                 # compare against the goldens
//   npm run test:export -- --update     # regenerate the goldens
import { readFileSync, writeFileSync } from "node:fs";
import { flattenFrames } from "../src/export_frames.js";
import { buildCsv } from "../src/workers/csv_export.js";
import { buildGpx } from "../src/workers/gpx_export.js";
import { buildSpectrumCsv } from "../src/workers/spectrum_export.js";

// Deterministic fixture exercising: valid GPS (→ trkpts), null & zero latitude
// (GPX skip / CSV "NaN"), a NaN cell, ints, floats, and sysConfig header rows.
const fieldNames = [
  "time",
  "GPS_coord[0]",
  "GPS_coord[1]",
  "GPS_altitude",
  "gyroADC[0]",
  "rcCommand[3]",
];
const sysConfig = {
  "Firmware revision": "Betaflight 4.5.0",
  "Log start datetime": "2024-01-01T00:00:00.000Z",
};
const chunkFrames = [
  [
    [0, 473712345, 85342111, 1234, 12, 1500],
    [1000, null, 85342111, 1234, -7, null],
  ],
  [
    [2000, 0, 85342111, 1234, 4, 1501],
    [3000, 473712999, 85342999, 1250, Number.NaN, 1502],
  ],
];
const opts = { columnDelimiter: ",", stringDelimiter: '"', quoteStrings: true };

const update = process.argv.includes("--update");
let failures = 0;

function compareGolden(name, golden, actual) {
  if (update) {
    writeFileSync(golden, actual);
    console.log(`updated ${name}: ${golden}`);
    return;
  }
  let expected;
  try {
    expected = readFileSync(golden, "utf8");
  } catch {
    console.error(`Missing golden ${golden}. Run: npm run test:export -- --update`);
    failures++;
    return;
  }
  if (actual === expected) {
    console.log(`ok   ${name} export golden matches`);
    return;
  }
  failures++;
  const a = actual.split("\n");
  const e = expected.split("\n");
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    if (a[i] !== e[i]) {
      console.error(`FAIL ${name} differs at line ${i + 1}:`);
      console.error(`  expected: ${e[i] ?? "<eof>"}`);
      console.error(`  actual:   ${a[i] ?? "<eof>"}`);
      break;
    }
  }
}

// --- flattenFrames unit checks -------------------------------------------
const flat = flattenFrames(chunkFrames);
if (!flat) {
  console.error("FAIL flattenFrames: returned null for a uniform fixture");
  failures++;
} else {
  const expectFlat = [
    0, 473712345, 85342111, 1234, 12, 1500, 1000, Number.NaN, 85342111, 1234, -7, Number.NaN,
    2000, 0, 85342111, 1234, 4, 1501, 3000, 473712999, 85342999, 1250, Number.NaN, 1502,
  ];
  const ok =
    flat.rowCount === 4 &&
    flat.rowLength === 6 &&
    flat.flat.length === expectFlat.length &&
    expectFlat.every((v, i) =>
      Number.isNaN(v) ? Number.isNaN(flat.flat[i]) : flat.flat[i] === v,
    );
  console.log(
    ok
      ? "ok   flattenFrames maps null/undefined → NaN and preserves values"
      : "FAIL flattenFrames: flat contents/dims mismatch",
  );
  if (!ok) failures++;
}
if (flattenFrames([]) !== null) {
  console.error("FAIL flattenFrames: empty input should return null");
  failures++;
}
if (flattenFrames([[[1, 2], [1, 2, 3]]]) !== null) {
  console.error("FAIL flattenFrames: ragged input should return null");
  failures++;
}

// --- CSV / GPX: golden + nested-vs-flat protocol equivalence -------------
const flatExtra = flat
  ? { flat: flat.flat, rowLength: flat.rowLength, rowCount: flat.rowCount }
  : {};

for (const c of [
  {
    name: "csv",
    build: buildCsv,
    golden: "test/fixtures/export.golden.csv",
    nested: { opts, fieldNames, frames: chunkFrames, sysConfig },
    flat: { opts, fieldNames, ...flatExtra, sysConfig },
  },
  {
    name: "gpx",
    build: buildGpx,
    golden: "test/fixtures/export.golden.gpx",
    nested: { fieldNames, frames: chunkFrames, sysConfig },
    flat: { fieldNames, ...flatExtra, sysConfig },
  },
]) {
  const nestedOut = c.build(c.nested);
  const flatOut = c.build(c.flat);
  if (nestedOut !== flatOut) {
    failures++;
    console.error(`FAIL ${c.name}: nested vs flat protocol output differs`);
    continue;
  }
  compareGolden(`${c.name} (nested == flat protocol)`, c.golden, nestedOut);
}

// --- spectrum CSV --------------------------------------------------------
const spectrumOut = buildSpectrumCsv({
  opts: { columnDelimiter: "," },
  fftOutput: [0, 1.5, 2.25, 3, 4.75, 6],
  blackBoxRate: 1000,
});
compareGolden("spectrum", "test/fixtures/export.golden.spectrum.csv", spectrumOut);

process.exit(update || failures === 0 ? 0 : 1);
