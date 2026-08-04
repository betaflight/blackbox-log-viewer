import { describe, it, expect } from "vitest";
import { emptyParsedCraftConfig, parseGearRatio, parseCraftConfigText } from "./craft_config.js";

describe("parseGearRatio", () => {
  it("parses an <a>,<b> setting value into the b/a multiplier", () => {
    expect(parseGearRatio("15,137")).toBeCloseTo(137 / 15);
  });

  it("returns null for missing, malformed, or zero-denominator values", () => {
    expect(parseGearRatio(undefined)).toBeNull();
    expect(parseGearRatio("")).toBeNull();
    expect(parseGearRatio("15")).toBeNull();
    expect(parseGearRatio("15,137,2")).toBeNull();
    expect(parseGearRatio("abc,137")).toBeNull();
    expect(parseGearRatio("0,137")).toBeNull();
  });
});

describe("parseCraftConfigText", () => {
  it("returns the empty shape for an empty document", () => {
    // "".split("\n") is [""], not [] - a single blank line, not zero lines.
    expect(parseCraftConfigText("")).toEqual({ ...emptyParsedCraftConfig(), lines: [""] });
  });

  it("extracts the craft name from a `set name = ...` line", () => {
    const text = ['set name = "My Heli"', "set main_rotor_gear_ratio = 15,137"].join("\n");
    const result = parseCraftConfigText(text);
    expect(result.craftName).toBe("My Heli");
    expect(result.settings.main_rotor_gear_ratio).toBe("15,137");
  });

  it("extracts the craft name from a bare `name ...` command", () => {
    const result = parseCraftConfigText('name "Blade 130X"');
    expect(result.craftName).toBe("Blade 130X");
    expect(result.commands.name).toEqual(['"Blade 130X"']);
  });

  it("keys settings lowercase regardless of source casing", () => {
    const result = parseCraftConfigText("set MAIN_ROTOR_GEAR_RATIO = 15,137");
    expect(result.settings.main_rotor_gear_ratio).toBe("15,137");
  });

  it("groups every other bare command by its command name", () => {
    const text = ["mixer_type 1", "feature GPS", "feature RPM_FILTER", "aux 0 0 0 900 1200"].join(
      "\n",
    );
    const result = parseCraftConfigText(text);
    expect(result.commands.mixer_type).toEqual(["1"]);
    expect(result.commands.feature).toEqual(["GPS", "RPM_FILTER"]);
    expect(result.commands.aux).toEqual(["0 0 0 900 1200"]);
  });

  it("ignores blank lines and comment lines, but keeps them in the raw lines list", () => {
    const text = ["# a comment", "", "set looptime = 125"].join("\n");
    const result = parseCraftConfigText(text);
    expect(result.settings.looptime).toBe("125");
    expect(Object.keys(result.commands)).toHaveLength(0);
    expect(result.lines).toEqual(["# a comment", "", "set looptime = 125"]);
  });

  it("strips trailing carriage returns from CRLF input", () => {
    const result = parseCraftConfigText("set looptime = 125\r\nset gyro_lpf = 3\r\n");
    expect(result.lines).toEqual(["set looptime = 125", "set gyro_lpf = 3", ""]);
  });
});
