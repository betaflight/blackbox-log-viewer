import { describe, it, expect } from "vitest";
import { estimateBlackBoxRate } from "./tools.js";

function fakeFlightLog({ actualLoggedTimeMicros, rowCount }) {
  return {
    getActualLoggedTime: () => actualLoggedTimeMicros,
    getCurrentLogRowsCount: () => rowCount,
  };
}

describe("estimateBlackBoxRate", () => {
  it("uses the configured (looptime-derived) rate when it matches the measured rate", () => {
    const sysConfig = {
      looptime: 1000, // 1000us -> 1000Hz gyro rate
      frameIntervalPNum: 1,
      frameIntervalPDenom: 1,
      pid_process_denom: 1,
    };
    // 5000 rows over 5s = 1000Hz measured, matching the configured rate exactly.
    const flightLog = fakeFlightLog({ actualLoggedTimeMicros: 5e6, rowCount: 5000 });

    const { rate, configuredRate, actualRate } = estimateBlackBoxRate(flightLog, sysConfig);

    expect(configuredRate).toBeCloseTo(1000, 5);
    expect(actualRate).toBeCloseTo(1000, 5);
    expect(rate).toBeCloseTo(1000, 5);
  });

  it("accounts for pid_process_denom and frameInterval decimation", () => {
    const sysConfig = {
      looptime: 500, // 2000Hz gyro rate
      frameIntervalPNum: 1,
      frameIntervalPDenom: 2, // only every 2nd frame logged
      pid_process_denom: 2, // PID loop runs at half the gyro rate
    };
    // Expected: (2000 * 1/2) / 2 = 500Hz
    const flightLog = fakeFlightLog({ actualLoggedTimeMicros: 10e6, rowCount: 5000 });

    const { configuredRate, rate } = estimateBlackBoxRate(flightLog, sysConfig);

    expect(configuredRate).toBeCloseTo(500, 5);
    expect(rate).toBeCloseTo(500, 5);
  });

  it("falls back to the measured rate when it disagrees with the configured rate by more than 5%", () => {
    const sysConfig = {
      looptime: 1000, // configured: 1000Hz
      frameIntervalPNum: 1,
      frameIntervalPDenom: 1,
      pid_process_denom: 1,
    };
    // 4000 rows over 5s = 800Hz measured - a 20% disagreement with the configured 1000Hz.
    const flightLog = fakeFlightLog({ actualLoggedTimeMicros: 5e6, rowCount: 4000 });

    const { rate, configuredRate, actualRate } = estimateBlackBoxRate(flightLog, sysConfig);

    expect(configuredRate).toBeCloseTo(1000, 5);
    expect(actualRate).toBeCloseTo(800, 5);
    expect(rate).toBe(800); // falls back to the (rounded) measured rate
  });

  it("tolerates a small (<5%) mismatch by keeping the configured rate", () => {
    const sysConfig = {
      looptime: 1000,
      frameIntervalPNum: 1,
      frameIntervalPDenom: 1,
      pid_process_denom: 1,
    };
    // 5010 rows over 5s = 1002Hz measured - a 0.2% disagreement, well under the 5% threshold.
    const flightLog = fakeFlightLog({ actualLoggedTimeMicros: 5e6, rowCount: 5010 });

    const { rate, configuredRate } = estimateBlackBoxRate(flightLog, sysConfig);

    expect(rate).toBe(configuredRate);
  });
});
