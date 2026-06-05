// Unit test for ExpoCurve (ported from the old browser-based test/index.js,
// which relied on a global that no longer exists). Runs in Node via esbuild.
//
//   npm run test:expo
import { ExpoCurve } from "../src/expo.js";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL ${message}`);
    failures++;
  }
}

function testExpoCurve(): void {
  const curve = new ExpoCurve(0, 0.7, 750, 1, 10);
  assert(curve.lookup(0) === 0, "ExpoCurve lookup(0) === 0");
  assert(curve.lookup(-750) === -1, "ExpoCurve lookup(-750) === -1");
  assert(curve.lookup(750) === 1, "ExpoCurve lookup(750) === 1");
}

function testExpoStraightLine(): void {
  const curve = new ExpoCurve(0, 1, 500, 1, 1);
  assert(curve.lookup(0) === 0, "straight lookup(0) === 0");
  assert(curve.lookup(-500) === -1, "straight lookup(-500) === -1");
  assert(curve.lookup(500) === 1, "straight lookup(500) === 1");
  assert(curve.lookup(-250) === -0.5, "straight lookup(-250) === -0.5");
  assert(curve.lookup(250) === 0.5, "straight lookup(250) === 0.5");
}

testExpoCurve();
testExpoStraightLine();

if (failures === 0) {
  console.log("ok   expo curve lookups");
}
process.exit(failures === 0 ? 0 : 1);
