import { describe, it, expect, beforeAll } from "vitest";
import {
  parseAutoTrimSelector,
  eventMatchesAutoTrimSelector,
  applyAutoTrim,
} from "./auto_trim.js";
import {
  FlightLogEvent,
  FIRMWARE_TYPE_ROTORFLIGHT,
  adjustFieldDefsList,
} from "./flightlog_fielddefs.js";
import { usePlaybackStore } from "./stores/playback.js";
import pinia from "./pinia_instance.js";

// FLIGHT_LOG_GOVSTATES is populated per the current log's firmware version.
beforeAll(() => {
  adjustFieldDefsList(FIRMWARE_TYPE_ROTORFLIGHT, "4.6.0");
});

function makeFlightLog({ minTime, maxTime, events }) {
  return {
    getMinTime: () => minTime,
    getMaxTime: () => maxTime,
    getChunksInTimeRange: () => [{ events }],
  };
}

describe("parseAutoTrimSelector", () => {
  it("parses the arm/disarm pseudo-selectors", () => {
    expect(parseAutoTrimSelector("arm")).toEqual({ type: "arm" });
    expect(parseAutoTrimSelector("disarm")).toEqual({ type: "disarm" });
  });

  it("parses govState/airborne selectors with their event value", () => {
    expect(parseAutoTrimSelector("govState:THROTTLE_OFF")).toEqual({
      type: "govState",
      value: "THROTTLE_OFF",
    });
    expect(parseAutoTrimSelector("airborne:LANDING")).toEqual({
      type: "airborne",
      value: "LANDING",
    });
  });

  it("returns null for missing or unrecognised selectors", () => {
    expect(parseAutoTrimSelector(null)).toBeNull();
    expect(parseAutoTrimSelector("")).toBeNull();
    expect(parseAutoTrimSelector("nonsense")).toBeNull();
    expect(parseAutoTrimSelector("bogusType:FOO")).toBeNull();
  });
});

describe("eventMatchesAutoTrimSelector", () => {
  it("matches the synthetic arm event only against the arm selector", () => {
    const armEvent = { event: null, time: 0, data: {}, isArmEvent: true };
    expect(eventMatchesAutoTrimSelector(armEvent, { type: "arm" })).toBe(true);
    expect(eventMatchesAutoTrimSelector(armEvent, { type: "disarm" })).toBe(false);
  });

  it("matches a DISARM event against the disarm selector", () => {
    const event = { event: FlightLogEvent.DISARM, time: 100, data: { reason: 1 } };
    expect(eventMatchesAutoTrimSelector(event, { type: "disarm" })).toBe(true);
    expect(eventMatchesAutoTrimSelector(event, { type: "arm" })).toBe(false);
  });

  it("matches a GOVERNOR_STATE event by its resolved state name", () => {
    const event = {
      event: FlightLogEvent.GOVERNOR_STATE,
      time: 100,
      data: { govState: 0 }, // THROTTLE_OFF is index 0
    };
    expect(
      eventMatchesAutoTrimSelector(event, { type: "govState", value: "THROTTLE_OFF" }),
    ).toBe(true);
    expect(
      eventMatchesAutoTrimSelector(event, { type: "govState", value: "ACTIVE" }),
    ).toBe(false);
  });

  it("matches an AIRBORNE_STATE event by its resolved state name", () => {
    const event = {
      event: FlightLogEvent.AIRBORNE_STATE,
      time: 100,
      data: { airborneState: 0 }, // LANDING is index 0
    };
    expect(
      eventMatchesAutoTrimSelector(event, { type: "airborne", value: "LANDING" }),
    ).toBe(true);
    expect(
      eventMatchesAutoTrimSelector(event, { type: "airborne", value: "TAKEOFF" }),
    ).toBe(false);
  });
});

describe("applyAutoTrim", () => {
  it("does nothing when the Auto Trim setting is off", () => {
    const flightLog = makeFlightLog({ minTime: 0, maxTime: 10e6, events: [] });
    const applied = applyAutoTrim(flightLog, { autoTrim: false });
    expect(applied).toBe(false);
  });

  it("trims from `govState:THROTTLE_OFF` to `airborne:LANDING`, offset by the configured seconds", () => {
    const events = [
      { event: FlightLogEvent.GOVERNOR_STATE, time: 2e6, data: { govState: 0 } }, // THROTTLE_OFF @ 2s
      { event: FlightLogEvent.GOVERNOR_STATE, time: 3e6, data: { govState: 4 } }, // ACTIVE @ 3s
      { event: FlightLogEvent.AIRBORNE_STATE, time: 8e6, data: { airborneState: 0 } }, // LANDING @ 8s
    ];
    const flightLog = makeFlightLog({ minTime: 0, maxTime: 10e6, events });

    const applied = applyAutoTrim(flightLog, {
      autoTrim: true,
      autoTrimStartEvent: "govState:THROTTLE_OFF",
      autoTrimStopEvent: "airborne:LANDING",
      autoTrimOffset: 1, // 1 second
    });

    expect(applied).toBe(true);

    const playbackStore = usePlaybackStore(pinia);
    expect(playbackStore.videoExportInTime).toBe(3e6); // 2s + 1s offset
    expect(playbackStore.videoExportOutTime).toBe(7e6); // 8s - 1s offset
  });

  it("uses the log's own start time for the 'arm' pseudo-selector", () => {
    const events = [
      { event: FlightLogEvent.DISARM, time: 9e6, data: { reason: 0 } },
    ];
    const flightLog = makeFlightLog({ minTime: 1e6, maxTime: 10e6, events });

    const applied = applyAutoTrim(flightLog, {
      autoTrim: true,
      autoTrimStartEvent: "arm",
      autoTrimStopEvent: "disarm",
      autoTrimOffset: 0,
    });

    expect(applied).toBe(true);

    const playbackStore = usePlaybackStore(pinia);
    expect(playbackStore.videoExportInTime).toBe(1e6);
    expect(playbackStore.videoExportOutTime).toBe(9e6);
  });

  it("only matches a stop event that occurs after the start event", () => {
    const events = [
      // LANDING happens once before the start event and once after - only the second should count
      { event: FlightLogEvent.AIRBORNE_STATE, time: 1e6, data: { airborneState: 0 } }, // LANDING @ 1s
      { event: FlightLogEvent.GOVERNOR_STATE, time: 2e6, data: { govState: 0 } }, // THROTTLE_OFF @ 2s
      { event: FlightLogEvent.AIRBORNE_STATE, time: 8e6, data: { airborneState: 0 } }, // LANDING @ 8s
    ];
    const flightLog = makeFlightLog({ minTime: 0, maxTime: 10e6, events });

    applyAutoTrim(flightLog, {
      autoTrim: true,
      autoTrimStartEvent: "govState:THROTTLE_OFF",
      autoTrimStopEvent: "airborne:LANDING",
      autoTrimOffset: 0,
    });

    const playbackStore = usePlaybackStore(pinia);
    expect(playbackStore.videoExportInTime).toBe(2e6);
    expect(playbackStore.videoExportOutTime).toBe(8e6);
  });

  it("does not trim when the start event never occurs", () => {
    const events = [
      { event: FlightLogEvent.AIRBORNE_STATE, time: 8e6, data: { airborneState: 0 } },
    ];
    const flightLog = makeFlightLog({ minTime: 0, maxTime: 10e6, events });

    const applied = applyAutoTrim(flightLog, {
      autoTrim: true,
      autoTrimStartEvent: "disarm",
      autoTrimStopEvent: "airborne:LANDING",
      autoTrimOffset: 0,
    });

    expect(applied).toBe(false);
  });

  it("does not trim when the offset would make the out point precede the in point", () => {
    const events = [
      { event: FlightLogEvent.GOVERNOR_STATE, time: 2e6, data: { govState: 0 } },
      { event: FlightLogEvent.AIRBORNE_STATE, time: 2.5e6, data: { airborneState: 0 } },
    ];
    const flightLog = makeFlightLog({ minTime: 0, maxTime: 10e6, events });

    const applied = applyAutoTrim(flightLog, {
      autoTrim: true,
      autoTrimStartEvent: "govState:THROTTLE_OFF",
      autoTrimStopEvent: "airborne:LANDING",
      autoTrimOffset: 5, // 5s offset each side easily overlaps a 0.5s gap
    });

    expect(applied).toBe(false);
  });
});
