// Golden-file characterization test for the CSV/GPX export workers.
//
// Locks the export OUTPUT FORMAT against committed snapshots and proves the two
// postMessage protocols are equivalent: the original nested frames array and
// the flattened transferable Float64Array (the export perf optimisation). Also
// unit-checks the real `flattenFrames` helper.
//
// The export workers are classic Web Workers (`onmessage`/`postMessage`), so
// they can't be imported in Node; their real source is executed in a small
// sandbox instead.
//
//   npm run test:export                 # compare against the goldens
//   npm run test:export -- --update     # regenerate the goldens
import { readFileSync, writeFileSync } from "node:fs";
import { flattenFrames } from "../src/export_frames.js";

// Execute an export worker's real source against a payload, capturing the
// string passed to postMessage. NOSONAR — trusted local worker source, test only.
function runWorker(src: string, data: unknown): string {
  let captured = "";
  // eslint-disable-next-line no-new-func
  const fn = new Function( // NOSONAR
    "event",
    "postMessage",
    `var onmessage;\n${src}\nreturn onmessage(event);`,
  ) as (event: { data: unknown }, post: (out: string) => void) => void;
  fn({ data }, (out: string) => {
    captured = out;
  });
  return captured;
}

const CSV_WORKER = readFileSync(
  "public/js/webworkers/csv-export-worker.js",
  "utf8",
);
const GPX_WORKER = readFileSync(
  "public/js/webworkers/gpx-export-worker.js",
  "utf8",
);

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
const sysConfig: Record<string, unknown> = {
  "Firmware revision": "Betaflight 4.5.0",
  "Log start datetime": "2024-01-01T00:00:00.000Z",
};
const chunkFrames: (number | null)[][][] = [
  [
    [0, 473712345, 85342111, 1234, 12, 1500],
    [1000, null, 85342111, 1234, -7, null],
  ],
  [
    [2000, 0, 85342111, 1234, 4, 1501],
    [3000, 473712999, 85342999, 1250, NaN, 1502],
  ],
];
const opts = { columnDelimiter: ",", stringDelimiter: '"', quoteStrings: true };

const update = process.argv.includes("--update");
let failures = 0;

// --- flattenFrames unit checks -------------------------------------------
const flat = flattenFrames(chunkFrames as unknown as number[][][]);
if (!flat) {
  console.error("FAIL flattenFrames: returned null for a uniform fixture");
  failures++;
} else {
  const expectFlat = [
    0, 473712345, 85342111, 1234, 12, 1500, 1000, NaN, 85342111, 1234, -7, NaN,
    2000, 0, 85342111, 1234, 4, 1501, 3000, 473712999, 85342999, 1250, NaN, 1502,
  ];
  const same =
    flat.rowCount === 4 &&
    flat.rowLength === 6 &&
    flat.flat.length === expectFlat.length &&
    expectFlat.every((v, i) =>
      Number.isNaN(v) ? Number.isNaN(flat.flat[i]) : flat.flat[i] === v,
    );
  if (same) {
    console.log("ok   flattenFrames maps null/undefined → NaN and preserves values");
  } else {
    console.error("FAIL flattenFrames: flat contents/dims mismatch");
    failures++;
  }
}
if (flattenFrames([]) !== null) {
  console.error("FAIL flattenFrames: empty input should return null");
  failures++;
}
if (flattenFrames([[[1, 2], [1, 2, 3]]]) !== null) {
  console.error("FAIL flattenFrames: ragged input should return null");
  failures++;
}

// --- worker output goldens + protocol equivalence ------------------------
const flatExtra = flat
  ? { flat: flat.flat, rowLength: flat.rowLength, rowCount: flat.rowCount }
  : {};

const CASES = [
  {
    name: "csv",
    worker: CSV_WORKER,
    golden: "test/fixtures/export.golden.csv",
    nested: { opts, fieldNames, frames: chunkFrames, sysConfig },
    flat: { opts, fieldNames, ...flatExtra, sysConfig },
  },
  {
    name: "gpx",
    worker: GPX_WORKER,
    golden: "test/fixtures/export.golden.gpx",
    nested: { fieldNames, frames: chunkFrames, sysConfig },
    flat: { fieldNames, ...flatExtra, sysConfig },
  },
];

for (const c of CASES) {
  const nestedOut = runWorker(c.worker, c.nested);
  const flatOut = runWorker(c.worker, c.flat);

  if (nestedOut !== flatOut) {
    failures++;
    console.error(`FAIL ${c.name}: nested vs flat protocol output differs`);
    continue;
  }

  if (update) {
    writeFileSync(c.golden, nestedOut);
    console.log(`updated ${c.name}: ${c.golden}`);
    continue;
  }

  let expected: string;
  try {
    expected = readFileSync(c.golden, "utf8");
  } catch {
    console.error(`Missing golden ${c.golden}. Run: npm run test:export -- --update`);
    failures++;
    continue;
  }

  if (nestedOut === expected) {
    console.log(`ok   ${c.name} export golden matches (nested == flat protocol)`);
    continue;
  }

  failures++;
  const a = nestedOut.split("\n");
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
