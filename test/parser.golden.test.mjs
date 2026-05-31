// Golden-file characterization test for FlightLogParser.
//
// Parses a deterministic synthetic log and compares the observable output
// (sysConfig, frame definitions, stats, and every onFrameReady frame) against
// a committed snapshot. This locks in current behavior so the upcoming
// JS -> TS conversion of flightlog_parser can be proven byte-for-byte
// equivalent.
//
// Run (bundled, because the parser is TypeScript with extensionless imports):
//   npm run test:parser           # compare against the golden snapshot
//   npm run test:parser -- --update   # regenerate the golden snapshot
//
// This module is bundled by esbuild and executed by node; see package.json.
import { readFileSync, writeFileSync } from "node:fs";
import { FlightLogParser } from "../src/flightlog_parser.js";
import { buildSyntheticLog } from "./fixtures/synthetic_log.mjs";

const GOLDEN_PATH = "test/fixtures/parser.golden.json";

function snapshot() {
  const logData = buildSyntheticLog();
  const parser = new FlightLogParser(logData);

  const frames = [];
  parser.onFrameReady = (valid, frame, frameType, frameStart, frameLength) => {
    frames.push({
      valid,
      frameType,
      frameLength,
      frame: frame ? Array.from(frame) : null,
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

const actual = `${JSON.stringify(snapshot(), null, 2)}\n`;

if (process.argv.includes("--update")) {
  writeFileSync(GOLDEN_PATH, actual);
  console.log(`Updated golden snapshot: ${GOLDEN_PATH}`);
  process.exit(0);
}

let expected;
try {
  expected = readFileSync(GOLDEN_PATH, "utf8");
} catch {
  console.error(
    `Missing golden snapshot ${GOLDEN_PATH}. Run: npm run test:parser -- --update`,
  );
  process.exit(1);
}

if (actual === expected) {
  console.log("ok   parser golden snapshot matches");
  process.exit(0);
}

// Report the first differing line to make regressions easy to locate.
const a = actual.split("\n");
const e = expected.split("\n");
for (let i = 0; i < Math.max(a.length, e.length); i++) {
  if (a[i] !== e[i]) {
    console.error(`FAIL parser golden snapshot differs at line ${i + 1}:`);
    console.error(`  expected: ${e[i] ?? "<eof>"}`);
    console.error(`  actual:   ${a[i] ?? "<eof>"}`);
    break;
  }
}
process.exit(1);
