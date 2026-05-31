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

// --- Tag-encoding writers (mirror ArrayDataStream decoders) ---

// TAG2_3S32, selector 0: three 2-bit signed fields (values must be in [-2, 1]).
function writeTag2_3S32_case0(arr, v0, v1, v2) {
  const code = (v) => v & 0x03; // inverse of signExtend2Bit for [-2..1]
  arr.push((code(v0) << 4) | (code(v1) << 2) | code(v2));
}

// TAG8_8SVB group: header bitmask (one bit per value) then a signed VB per set bit.
function writeTag8_8SVB(arr, values) {
  if (values.length === 1) {
    writeSignedVB(arr, values[0]); // matches the valueCount === 1 fast path
    return;
  }
  let header = 0;
  for (let i = 0; i < values.length; i++) header |= 1 << i;
  arr.push(header & 0xff);
  for (let i = 0; i < values.length; i++) writeSignedVB(arr, values[i]);
}

/**
 * A richer synthetic log that exercises the paths the simple log does not:
 * GPS home (H) + GPS (G) frames with the HOME_COORD/HOME_COORD_1 predictor
 * pair, slow (S) frames, event (E) frames (SYNC_BEEP + End-of-log), and the
 * TAG2_3S32 / TAG8_8SVB / NEG_14BIT field encodings inside main frames.
 *
 * Main-frame schema (9 fields):
 *   0 loopIteration  I:UVB pred0       P:NULL  pred INC
 *   1 time           I:UVB pred0       P:SVB   pred PREVIOUS
 *   2 gyroADC[0]  \
 *   3 gyroADC[1]   > TAG2_3S32, pred 0 (both I and P)
 *   4 gyroADC[2]  /
 *   5 motor[0]    \
 *   6 motor[1]     > TAG8_8SVB group, pred 0
 *   7 motor[2]    /
 *   8 debug[0]       NEG_14BIT, pred 0
 */
export function buildComplexLog() {
  const arr = [];

  header(arr, "Product:Blackbox flight data recorder by Nicholas Sherlock");
  header(arr, "Data version:2");
  header(arr, "Firmware revision:Betaflight 4.5.0 (norevision) STM32F405");
  header(
    arr,
    "Field I name:loopIteration,time,gyroADC[0],gyroADC[1],gyroADC[2],motor[0],motor[1],motor[2],debug[0]",
  );
  header(arr, "Field I signed:0,0,1,1,1,0,0,0,1");
  header(arr, "Field I predictor:0,0,0,0,0,0,0,0,0");
  header(arr, "Field I encoding:1,1,7,7,7,6,6,6,3"); // UVB,UVB,TAG2_3S32(x3),TAG8_8SVB(x3),NEG_14BIT
  header(arr, "Field P predictor:6,1,0,0,0,0,0,0,0"); // INC,PREVIOUS,raw...
  header(arr, "Field P encoding:9,0,7,7,7,6,6,6,3"); // NULL,SVB,TAG2_3S32,TAG8_8SVB,NEG_14BIT
  // GPS home + GPS frames (both required to enable GPS parsing)
  header(arr, "Field H name:GPS_home[0],GPS_home[1]");
  header(arr, "Field H signed:1,1");
  header(arr, "Field H predictor:0,0");
  header(arr, "Field H encoding:0,0"); // SVB
  header(arr, "Field G name:time,GPS_coord[0],GPS_coord[1],GPS_numSat");
  header(arr, "Field G signed:0,1,1,0");
  header(arr, "Field G predictor:0,7,7,0"); // time, HOME_COORD pair, numSat
  header(arr, "Field G encoding:0,0,0,0"); // SVB
  // Slow frame
  header(arr, "Field S name:flightModeFlags,stateFlags,failsafePhase");
  header(arr, "Field S signed:0,0,0");
  header(arr, "Field S predictor:0,0,0");
  header(arr, "Field S encoding:1,1,1"); // UVB
  header(arr, "I interval:1");
  header(arr, "P interval:1");

  // I frame: iter=0, time=1000, gyro=[1,0,-1], motor=[10,20,30], debug=-5
  arr.push(0x49); // 'I'
  writeUnsignedVB(arr, 0);
  writeUnsignedVB(arr, 1000);
  writeTag2_3S32_case0(arr, 1, 0, -1);
  writeTag8_8SVB(arr, [10, 20, 30]);
  writeUnsignedVB(arr, 5); // NEG_14BIT -> -signExtend14Bit(5) = -5

  // P frame: INC iter, time +1000, gyro raw [-2,1,0], motor raw [1,2,3], debug -3
  arr.push(0x50); // 'P'
  writeSignedVB(arr, 1000); // time delta (PREVIOUS)
  writeTag2_3S32_case0(arr, -2, 1, 0);
  writeTag8_8SVB(arr, [1, 2, 3]);
  writeUnsignedVB(arr, 3); // -3

  // GPS home frame: [123456, 654321]
  arr.push(0x48); // 'H'
  writeSignedVB(arr, 123456);
  writeSignedVB(arr, 654321);

  // GPS frame: time=5000, coord deltas +10/+20 from home, numSat=8
  arr.push(0x47); // 'G'
  writeSignedVB(arr, 5000);
  writeSignedVB(arr, 10);
  writeSignedVB(arr, 20);
  writeSignedVB(arr, 8);

  // Slow frame: [2,1,0]
  arr.push(0x53); // 'S'
  writeUnsignedVB(arr, 2);
  writeUnsignedVB(arr, 1);
  writeUnsignedVB(arr, 0);

  // Event: SYNC_BEEP (type 0) with a time value
  arr.push(0x45); // 'E'
  arr.push(0x00); // FlightLogEvent.SYNC_BEEP
  writeUnsignedVB(arr, 123456);

  // Event: End of log (type 255) terminates the log
  arr.push(0x45); // 'E'
  arr.push(0xff); // FlightLogEvent.LOG_END
  pushAscii(arr, "End of log\0");

  return new Uint8Array(arr);
}
