// Deterministic synthetic Betaflight blackbox log for golden-file testing of
// the parser. Hand-encoded so the byte layout is fully under our control.
//
// Schema (4 fields): loopIteration, time, axisP[0], motor[0]
//   I frame: predictor 0 (raw); encoding UVB,UVB,SVB,UVB
//   P frame: predictor INC,PREVIOUS,PREVIOUS,PREVIOUS; encoding NULL,SVB,SVB,SVB
//
// This is NOT a captured flight; it exists to exercise header parsing, frame
// definitions, intra/inter-frame decoding, predictors (INC/PREVIOUS), and the
// stats/onFrameReady surface deterministically.

const NEWLINE = 0x0a;

function pushAscii(arr, str) {
  for (let i = 0; i < str.length; i++) arr.push(str.charCodeAt(i));
}

function header(arr, line) {
  arr.push(0x48, 0x20); // 'H', ' '
  pushAscii(arr, line);
  arr.push(NEWLINE);
}

function writeUnsignedVB(arr, value) {
  value >>>= 0;
  while (value > 0x7f) {
    arr.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  arr.push(value & 0x7f);
}

function writeSignedVB(arr, value) {
  // ZigZag encode then unsigned VB (matches ArrayDataStream.readSignedVB).
  const zig = ((value << 1) ^ (value >> 31)) >>> 0;
  writeUnsignedVB(arr, zig);
}

export function buildSyntheticLog() {
  const arr = [];

  // --- Header ---
  header(arr, "Product:Blackbox flight data recorder by Nicholas Sherlock");
  header(arr, "Data version:2");
  header(arr, "Firmware revision:Betaflight 4.5.0 (norevision) STM32F405");
  header(arr, "Field I name:loopIteration,time,axisP[0],motor[0]");
  header(arr, "Field I signed:0,0,1,0");
  header(arr, "Field I predictor:0,0,0,0");
  header(arr, "Field I encoding:1,1,0,1"); // UVB,UVB,SVB,UVB
  header(arr, "Field P predictor:6,1,1,1"); // INC,PREVIOUS,PREVIOUS,PREVIOUS
  header(arr, "Field P encoding:9,0,0,0"); // NULL,SVB,SVB,SVB
  header(arr, "I interval:1");
  header(arr, "P interval:1");

  // --- Data: one I frame followed by three P frames ---
  // I frame (raw values): iter=0, time=1000, axisP=-5, motor=1100
  arr.push(0x49); // 'I'
  writeUnsignedVB(arr, 0); // loopIteration
  writeUnsignedVB(arr, 1000); // time
  writeSignedVB(arr, -5); // axisP[0]
  writeUnsignedVB(arr, 1100); // motor[0]

  // P frames: iteration auto-increments (INC); time/axisP/motor are deltas from previous
  const pDeltas = [
    { dt: 1000, dAxisP: 3, dMotor: 10 },
    { dt: 1001, dAxisP: -8, dMotor: -4 },
    { dt: 999, dAxisP: 0, dMotor: 25 },
  ];
  for (const p of pDeltas) {
    arr.push(0x50); // 'P'
    // field 0 (loopIteration) is INC -> no bytes
    writeSignedVB(arr, p.dt); // time delta
    writeSignedVB(arr, p.dAxisP); // axisP delta
    writeSignedVB(arr, p.dMotor); // motor delta
  }

  return new Uint8Array(arr);
}
