// Parses a Rotorflight CLI "dump all" / "diff all" export ("craft config"), independent of how
// the result gets stored/persisted (see stores/craftConfig.js for that).
// Ported from https://github.com/rotorflight/rotorflight-blackbox (js/craft_config.js).

export function emptyParsedCraftConfig() {
  return { craftName: null, settings: {}, commands: {}, lines: [] };
}

/**
 * Parses a `<a>,<b>` gear ratio setting value (e.g. "15,137") into the multiplier b/a,
 * or null if the value is missing or not in that format.
 */
export function parseGearRatio(rawValue) {
  if (!rawValue) {
    return null;
  }

  const parts = rawValue.split(",");
  if (parts.length !== 2) {
    return null;
  }

  const a = Number.parseFloat(parts[0]);
  const b = Number.parseFloat(parts[1]);

  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) {
    return null;
  }

  return b / a;
}

/**
 * Parses the text of a Rotorflight/Betaflight CLI "dump all" or "diff all" export.
 *
 * `set key = value` lines populate `settings` (keyed lowercase). Every other bare CLI command
 * (name, mixer_type, feature, aux, mmix, smix, ...) is grouped by command name into `commands`,
 * since a fixed schema can't anticipate every field a future feature might need.
 */
export function parseCraftConfigText(text) {
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));

  const settings = {};
  const commands = {};
  let craftName = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.charAt(0) === "#") {
      continue;
    }

    const setMatch = line.match(/^set\s+([\w.-]+)\s*=\s*(.+)$/i);
    if (setMatch) {
      const setKey = setMatch[1].toLowerCase();
      const setValue = setMatch[2].trim();
      settings[setKey] = setValue;

      if (setKey === "name" && setValue) {
        craftName = setValue.replace(/^"(.*)"$/, "$1");
      }

      continue;
    }

    const spaceIndex = line.search(/\s/);
    const cmd = (spaceIndex === -1 ? line : line.substring(0, spaceIndex)).toLowerCase();
    const args = spaceIndex === -1 ? "" : line.substring(spaceIndex + 1).trim();

    if (!commands[cmd]) {
      commands[cmd] = [];
    }
    commands[cmd].push(args);

    if (cmd === "name" && args) {
      craftName = args.replace(/^"(.*)"$/, "$1");
    }
  }

  return { craftName, settings, commands, lines };
}
