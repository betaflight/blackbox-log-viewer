import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FIRMWARE_TYPE_ROTORFLIGHT,
  FIRMWARE_TYPE_BETAFLIGHT,
  FLIGHT_LOG_FAILSAFE_PHASE_NAME,
  SERIALRX_PROVIDER,
} from "./flightlog_fielddefs.js";

describe("FLIGHT_LOG_FAILSAFE_PHASE_NAME", () => {
  it("includes the GPS Rescue failsafe phases used by Rotorflight logs", () => {
    expect(FLIGHT_LOG_FAILSAFE_PHASE_NAME).toEqual([
      "IDLE",
      "RX_LOSS_DETECTED",
      "LANDING",
      "LANDED",
      "RX_LOSS_MONITORING",
      "RX_LOSS_RECOVERED",
      "GPS_RESCUE",
    ]);
  });
});

describe("SERIALRX_PROVIDER", () => {
  it("keeps the original entries at their original indices", () => {
    expect(SERIALRX_PROVIDER.slice(0, 15)).toEqual([
      "SPEK1024",
      "SPEK2048",
      "SBUS",
      "SUMD",
      "SUMH",
      "XB-B",
      "XB-B-RJ01",
      "IBUS",
      "JETIEXBUS",
      "CRSF",
      "SRXL",
      "CUSTOM",
      "FPORT",
      "SRXL2",
      "GHST",
    ]);
  });

  it("includes the previously-missing receiver protocols", () => {
    expect(SERIALRX_PROVIDER).toHaveLength(19);
    expect(SERIALRX_PROVIDER.slice(15)).toEqual(["SBUS2", "FPORT2", "FBUS", "XB-A"]);
  });
});

// RATES_TYPE and FILTER_TYPE are mutated in place by adjustFieldDefsList() depending on the
// firmware type of the loaded log, so each case gets a fresh module instance to avoid leaking
// state between assertions.
describe("RATES_TYPE / FILTER_TYPE firmware-specific enums", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("defaults to the Betaflight rates enum (no NONE, no ROTORFLIGHT)", async () => {
    const mod = await import("./flightlog_fielddefs.js");
    expect(mod.RATES_TYPE).toEqual(["BETAFLIGHT", "RACEFLIGHT", "KISS", "ACTUAL", "QUICK"]);
  });

  it("defaults to the Betaflight filter type enum (PT1 at index 0)", async () => {
    const mod = await import("./flightlog_fielddefs.js");
    expect(mod.FILTER_TYPE).toEqual(["PT1", "BIQUAD", "PT2", "PT3"]);
  });

  it("switches to the Rotorflight rates enum for Rotorflight logs, with NONE first and ROTORFLIGHT last", async () => {
    const mod = await import("./flightlog_fielddefs.js");
    mod.adjustFieldDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.6.0");
    expect(mod.RATES_TYPE).toEqual([
      "NONE",
      "BETAFLIGHT",
      "RACEFLIGHT",
      "KISS",
      "ACTUAL",
      "QUICK",
      "ROTORFLIGHT",
    ]);
  });

  it("switches to the Rotorflight filter type enum for Rotorflight logs, with PT1 at index 3", async () => {
    const mod = await import("./flightlog_fielddefs.js");
    mod.adjustFieldDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.6.0");
    expect(mod.FILTER_TYPE).toEqual([
      "NONE",
      "FIRST_ORDER",
      "SECOND_ORDER",
      "PT1",
      "PT2",
      "PT3",
      "ORDER1",
      "BUTTER",
      "BESSEL",
      "DAMPED",
    ]);
    expect(mod.FILTER_TYPE[3]).toBe("PT1");
  });

  it("leaves the Betaflight rates/filter enums untouched for Betaflight logs", async () => {
    const mod = await import("./flightlog_fielddefs.js");
    mod.adjustFieldDefsList(FIRMWARE_TYPE_BETAFLIGHT, "4.5.0");
    expect(mod.RATES_TYPE).toEqual(["BETAFLIGHT", "RACEFLIGHT", "KISS", "ACTUAL", "QUICK"]);
    expect(mod.FILTER_TYPE).toEqual(["PT1", "BIQUAD", "PT2", "PT3"]);
  });
});
