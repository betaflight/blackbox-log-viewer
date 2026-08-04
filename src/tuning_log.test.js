import { describe, it, expect } from "vitest";
import { makeId, create, buildConfigSummary, logTimestamp, addEntry, buildFilename, validationError } from "./tuning_log.js";

describe("makeId", () => {
  it("is stable for the same input", () => {
    expect(makeId("2026-01-02T03:04:05.000Z")).toBe(makeId("2026-01-02T03:04:05.000Z"));
  });

  it("differs for different input", () => {
    expect(makeId("2026-01-02T03:04:05.000Z")).not.toBe(makeId("2026-01-02T03:04:05.001Z"));
  });
});

describe("create", () => {
  it("builds an empty log with the given name/craftName", () => {
    const log = create("My Log", "My Heli");
    expect(log.formatVersion).toBe(1);
    expect(log.name).toBe("My Log");
    expect(log.craftName).toBe("My Heli");
    expect(log.entries).toEqual([]);
    expect(typeof log.logId).toBe("string");
  });

  it("falls back to craftName, then a default, when no name is given", () => {
    expect(create(null, "My Heli").name).toBe("My Heli");
    expect(create(null, null).name).toBe("Tuning Log");
  });
});

describe("buildConfigSummary", () => {
  it("flattens sorted key/value pairs, skipping null/undefined/function values", () => {
    const summary = buildConfigSummary({ b: 2, a: 1, skipMe: undefined, alsoSkip: () => {} });
    expect(summary).toBe("a: 1\nb: 2");
  });

  it("returns an empty string for an empty/missing config", () => {
    expect(buildConfigSummary({})).toBe("");
    expect(buildConfigSummary(undefined)).toBe("");
  });
});

describe("logTimestamp", () => {
  it("uses the log's own recorded start time when present and valid", () => {
    const iso = logTimestamp({ "Log start datetime": "2026-03-04T05:06:07.000+00:00" });
    expect(iso).toBe("2026-03-04T05:06:07.000Z");
  });

  it("falls back to fileLastModified when the header is missing", () => {
    const epochMs = Date.UTC(2026, 0, 15, 12, 0, 0);
    expect(logTimestamp({}, epochMs)).toBe(new Date(epochMs).toISOString());
  });

  it("falls back to fileLastModified for the no-RTC sentinel date", () => {
    const epochMs = Date.UTC(2026, 0, 15, 12, 0, 0);
    const iso = logTimestamp({ "Log start datetime": "0000-01-01T00:00:00.000+00:00" }, epochMs);
    expect(iso).toBe(new Date(epochMs).toISOString());
  });
});

describe("addEntry", () => {
  it("appends an entry with a derived id and returns it", () => {
    const log = create("Log", "Heli");
    const entry = addEntry(log, { timestamp: "2026-01-02T03:04:05.000Z", image: "data:x", config: "a: 1" });

    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]).toBe(entry);
    expect(entry.id).toBe(makeId("2026-01-02T03:04:05.000Z"));
    expect(entry.image).toBe("data:x");
    expect(entry.notes).toBe("");
  });
});

describe("buildFilename", () => {
  it("sanitizes the log name and includes a timestamp", () => {
    const filename = buildFilename({ name: "My Heli / Test!" });
    // Runs of characters outside [a-z0-9_-] collapse to a single "_" each.
    expect(filename).toMatch(/^RF_TUNING_LOG_My_Heli_Test__\d{8}_\d{6}\.json$/);
  });

  it("falls back to a default name when the log has none", () => {
    expect(buildFilename({})).toMatch(/^RF_TUNING_LOG_TuningLog_\d{8}_\d{6}\.json$/);
  });
});

describe("validationError", () => {
  it("accepts a well-formed tuning log", () => {
    expect(validationError(create("Log", "Heli"))).toBeNull();
  });

  it("rejects non-objects, arrays, and missing formatVersion", () => {
    expect(validationError(null)).not.toBeNull();
    expect(validationError([])).not.toBeNull();
    expect(validationError({})).not.toBeNull();
  });

  it("rejects a malformed entries field", () => {
    expect(validationError({ formatVersion: 1, entries: "nope" })).not.toBeNull();
    expect(validationError({ formatVersion: 1, entries: [null] })).not.toBeNull();
  });
});
