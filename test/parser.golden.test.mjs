// Golden-file characterization test for FlightLogParser.
//
// Parses deterministic synthetic logs and compares the observable output
// (sysConfig, frame definitions, stats, and every onFrameReady frame) against
// committed snapshots. This locks in current behavior so the upcoming
// JS -> TS conversion of flightlog_parser can be proven byte-for-byte
// equivalent.
//
// Two fixtures:
//   - simple:  header + I/P frames (predictors INC/PREVIOUS, VB encodings)
//   - complex: adds GPS home/GPS (HOME_COORD predictor pair), slow + event
//              frames, and TAG2_3S32 / TAG8_8SVB / NEG_14BIT encodings
//
// Run (bundled, because the parser is TypeScript with extensionless imports):
//   npm run test:parser                 # compare against the golden snapshots
//   npm run test:parser -- --update     # regenerate the golden snapshots
import { readFileSync, writeFileSync } from "node:fs";
import { FlightLogParser } from "../src/flightlog_parser.js";
import { buildSyntheticLog, buildComplexLog } from "./fixtures/synthetic_log.mjs";

const CASES = [
  { name: "simple", build: buildSyntheticLog, golden: "test/fixtures/parser.golden.json" },
  { name: "complex", build: buildComplexLog, golden: "test/fixtures/parser.golden.complex.json" },
];

function serializeFrame(frame) {
  if (frame == null) {
    return null;
  }
  if (Array.isArray(frame)) {
    return Array.from(frame);
  }
  // Event frames pass the decoded event object rather than a numeric array.
  return JSON.parse(JSON.stringify(frame));
}

function snapshot(logData) {
  const parser = new FlightLogParser(logData);

  const frames = [];
  parser.onFrameReady = (valid, frame, frameType, frameStart, frameLength) => {
    frames.push({
      valid,
      frameType,
      frameLength,
      frame: serializeFrame(frame),
    });
  };

  parser.parseHeader(0, logData.length);
  parser.resetDataState();
  parser.parseLogData(false);

  const sc = parser.sysConfig;
  const sysConfig = {
    firmwareType: sc.firmwareType,
    firmwareVersion: sc.firmwareVersion,
    firmware: sc.firmware,
    firmwarePatch: sc.firmwarePatch,
    frameIntervalI: sc.frameIntervalI,
    frameIntervalPNum: sc.frameIntervalPNum,
    frameIntervalPDenom: sc.frameIntervalPDenom,
  };

  const frameDefSnapshot = (def) =>
    def
      ? {
          name: def.name,
          count: def.count,
          signed: def.signed,
          predictor: def.predictor,
          encoding: def.encoding,
          nameToIndex: def.nameToIndex,
        }
      : null;

  const stats = parser.stats;
  const frameStats = {};
  for (const k of Object.keys(stats.frame)) {
    const f = stats.frame[k];
    frameStats[k] = {
      bytes: f.bytes,
      validCount: f.validCount,
      corruptCount: f.corruptCount,
      desyncCount: f.desyncCount,
      field: f.field,
    };
  }

  return {
    logByteLength: logData.length,
    sysConfig,
    frameDefs: {
      I: frameDefSnapshot(parser.frameDefs.I),
      P: frameDefSnapshot(parser.frameDefs.P),
      H: frameDefSnapshot(parser.frameDefs.H),
      G: frameDefSnapshot(parser.frameDefs.G),
      S: frameDefSnapshot(parser.frameDefs.S),
    },
    stats: {
      totalBytes: stats.totalBytes,
      totalCorruptFrames: stats.totalCorruptFrames,
      intentionallyAbsentIterations: stats.intentionallyAbsentIterations,
      frame: frameStats,
    },
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
    console.error(`Missing golden ${c.golden}. Run: npm run test:parser -- --update`);
    failures++;
    continue;
  }

  if (actual === expected) {
    console.log(`ok   ${c.name} golden snapshot matches`);
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

if (update) {
  process.exit(0);
}
process.exit(failures === 0 ? 0 : 1);
