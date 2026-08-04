import { describe, it, expect, beforeEach } from "vitest";
import { StepResponseCalc, STEP_RESPONSE_LEN_SEC } from "./graph_stepresponse_calc.js";

const BLACKBOX_RATE = 1000; // Hz, so looptime math below comes out exact

const SYS_CONFIG = {
  looptime: 1000, // 1000us -> 1000Hz gyro rate
  frameIntervalPNum: 1,
  frameIntervalPDenom: 1,
  pid_process_denom: 1,
};

// Deterministic pseudo-random broadband signal (LCG), scaled to comfortably clear the
// 20 deg/s peak-to-peak stick-movement threshold every window needs to be accepted.
function broadbandSignal(count, amplitude = 60) {
  const out = new Float64Array(count);
  let seed = 12345;
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (seed / 0x7fffffff - 0.5) * 2 * amplitude;
  }
  return out;
}

function makeFlightLog({ setpoint, gyro, rate = BLACKBOX_RATE }) {
  const count = setpoint.length;
  const durationSec = count / rate;

  return {
    getMinTime: () => 0,
    getMaxTime: () => durationSec * 1e6,
    getActualLoggedTime: () => durationSec * 1e6,
    getCurrentLogRowsCount: () => count,
    getMainFieldIndexByName: (name) => {
      if (name.startsWith("setpoint[")) return 0;
      if (name.startsWith("gyroADC[")) return 1;
      return null;
    },
    getChunksInTimeRange: () => [
      {
        frames: Array.from({ length: count }, (_, i) => [setpoint[i], gyro[i]]),
      },
    ],
  };
}

describe("StepResponseCalc", () => {
  beforeEach(() => {
    StepResponseCalc.setInTime(0);
    StepResponseCalc.setOutTime(0);
  });

  it("reports no data when the setpoint/gyro fields are missing from the log", () => {
    const flightLog = {
      getMinTime: () => 0,
      getMaxTime: () => 5e6,
      getActualLoggedTime: () => 5e6,
      getCurrentLogRowsCount: () => 5000,
      getMainFieldIndexByName: () => null,
      getChunksInTimeRange: () => [],
    };
    StepResponseCalc.initialize(flightLog, SYS_CONFIG);

    const result = StepResponseCalc.calculate();

    expect(result.roll.windowCount).toBe(0);
    expect(result.roll.valid).toBe(false);
    expect(result.roll.response.every((v) => v === 0)).toBe(true);
  });

  it("reports no data when the pilot never moved the stick (flat setpoint)", () => {
    const count = BLACKBOX_RATE * 6; // 6s, plenty of windows if excitation were present
    const setpoint = new Float64Array(count); // all zero
    const gyro = new Float64Array(count);
    const flightLog = makeFlightLog({ setpoint, gyro });
    StepResponseCalc.initialize(flightLog, SYS_CONFIG);

    const result = StepResponseCalc.calculate();

    expect(result.roll.windowCount).toBe(0);
    expect(result.roll.valid).toBe(false);
  });

  it("recovers a near-perfect step response (rises to ~1.0 and stays there) for instant, unity-gain tracking", () => {
    const count = BLACKBOX_RATE * 10; // 10s of flight -> plenty of accepted windows
    const setpoint = broadbandSignal(count);
    const gyro = setpoint.slice(); // gyro tracks setpoint exactly: perfect tuning
    const flightLog = makeFlightLog({ setpoint, gyro });
    StepResponseCalc.initialize(flightLog, SYS_CONFIG);
    StepResponseCalc.setOutTime(count / BLACKBOX_RATE * 1e6);

    const result = StepResponseCalc.calculate();
    const roll = result.roll;

    expect(roll.windowCount).toBeGreaterThan(10);
    expect(roll.valid).toBe(true);
    expect(roll.time.length).toBe(Math.round(STEP_RESPONSE_LEN_SEC * BLACKBOX_RATE));

    // Perfect unity-gain tracking -> the deconvolved impulse response is a delta at t=0,
    // so the step response (its cumulative sum) should sit at ~1.0 for the whole window.
    for (let n = 0; n < roll.response.length; n++) {
      expect(Math.abs(roll.response[n] - 1.0)).toBeLessThan(0.08);
    }
  });

  it("discards a window poisoned by a non-finite (dropped-frame) sample instead of returning NaN", () => {
    const count = BLACKBOX_RATE * 10;
    const setpoint = broadbandSignal(count);
    const gyro = setpoint.slice();

    // Corrupt one sample near the middle of the log, as a dropped/corrupted frame would.
    gyro[Math.floor(count / 2)] = NaN;

    const flightLog = makeFlightLog({ setpoint, gyro });
    StepResponseCalc.initialize(flightLog, SYS_CONFIG);
    StepResponseCalc.setOutTime((count / BLACKBOX_RATE) * 1e6);

    const result = StepResponseCalc.calculate();
    const roll = result.roll;

    expect(Number.isFinite(roll.response[0])).toBe(true);
    expect(roll.response.every((v) => Number.isFinite(v))).toBe(true);
    // Still plenty of clean windows away from the corrupted sample.
    expect(roll.windowCount).toBeGreaterThan(0);
  });
});
