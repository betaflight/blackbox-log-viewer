import { describe, it, expect, beforeAll } from "vitest";
import { FlightLogFieldPresenter } from "./flightlog_fields_presenter.js";
import {
  FIRMWARE_TYPE_ROTORFLIGHT,
  FIRMWARE_TYPE_BETAFLIGHT,
  adjustFieldDefsList,
  DEBUG_MODE,
} from "./flightlog_fielddefs.js";

// Rotorflight debug modes (governor, TTA, cross-coupling, etc.) previously fell back to raw
// "debug[N]" labels because their friendly names were never added. These checks drive the same
// public lookup the graph legend uses (fieldNameToFriendly) for each newly-added group, resolving
// the debug mode's numeric index dynamically so the test doesn't depend on enum ordering.
describe("Rotorflight debug-mode friendly field names", () => {
  beforeAll(() => {
    adjustFieldDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.6.0");
    FlightLogFieldPresenter.adjustDebugDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.6.0");
  });

  function friendlyNameFor(debugModeName, fieldName) {
    const debugMode = DEBUG_MODE.indexOf(debugModeName);
    expect(debugMode).toBeGreaterThanOrEqual(0);
    return FlightLogFieldPresenter.fieldNameToFriendly(fieldName, debugMode);
  }

  it("labels GOVERNOR debug fields instead of falling back to raw names", () => {
    expect(friendlyNameFor("GOVERNOR", "debug[4]")).toBe("Gov P");
    expect(friendlyNameFor("GOVERNOR", "debug[0]")).toBe("HS Requested");
  });

  it("labels TTA (Tail Torque Assist) debug fields", () => {
    expect(friendlyNameFor("TTA", "debug[1]")).toBe("TTA");
    expect(friendlyNameFor("TTA", "debug[3]")).toBe("TTA Add");
  });

  it("labels CROSS_COUPLING debug fields", () => {
    expect(friendlyNameFor("CROSS_COUPLING", "debug[0]")).toBe("Roll Derivative");
  });

  it("labels RESCUE and RESCUE_ALTHOLD debug fields", () => {
    expect(friendlyNameFor("RESCUE", "debug[0]")).toBe("Roll Attitude");
    expect(friendlyNameFor("RESCUE_ALTHOLD", "debug[5]")).toBe("PID Sum");
  });

  it("labels ESC_SENSOR_DATA / ESC_SENSOR_FRAME debug fields", () => {
    expect(friendlyNameFor("ESC_SENSOR_DATA", "debug[0]")).toBe("RPM");
    expect(friendlyNameFor("ESC_SENSOR_FRAME", "debug[0]")).toBe("Byte Count");
  });

  it("labels D_MIN debug fields (reached via Betaflight's D_MAX->D_MIN rename on older firmware)", () => {
    adjustFieldDefsList(FIRMWARE_TYPE_BETAFLIGHT, "4.4.0");
    FlightLogFieldPresenter.adjustDebugDefsList(FIRMWARE_TYPE_BETAFLIGHT, "4.4.0");

    expect(friendlyNameFor("D_MIN", "debug[2]")).toBe("Actual D [roll]");

    adjustFieldDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.6.0");
    FlightLogFieldPresenter.adjustDebugDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.6.0");
  });

  it("labels AIRBORNE and POLAR_RATE debug fields", () => {
    expect(friendlyNameFor("AIRBORNE", "debug[7]")).toBe("Is Airborne");
    expect(friendlyNameFor("POLAR_RATE", "debug[0]")).toBe("SP Roll");
  });

  it("falls back to the pre-4.5.0 YAW_PRECOMP layout on older Rotorflight firmware", () => {
    adjustFieldDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.3.0");
    FlightLogFieldPresenter.adjustDebugDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.3.0");

    expect(friendlyNameFor("YAW_PRECOMP", "debug[0]")).toBe("Collective Deflection");

    // restore 4.6.0 state for any tests that run after this one
    adjustFieldDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.6.0");
    FlightLogFieldPresenter.adjustDebugDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.6.0");
  });

  it("uses the newer YAW_PRECOMP layout on 4.5.0+ Rotorflight firmware", () => {
    expect(friendlyNameFor("YAW_PRECOMP", "debug[0]")).toBe("Total Precompensation");
  });
});
