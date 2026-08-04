// Model for a "Tuning Log": a JSON-serializable history of step response captures (image +
// flight log configuration + notes) for a craft, so changes can be tracked over time and replayed
// as context for AI tuning advice.
// Ported from https://github.com/bph838/rotorflight-blackbox-bellsandwhistles (js/tuning_log.js).
// That version ran under NW.js and persisted itself directly to a file on disk (Node `fs`/
// `crypto`); this app is a plain browser SPA, so persistence instead lives in
// stores/tuningLog.js (localStorage, with explicit export/import) and hashing uses a small
// dependency-free function instead of Node's `crypto` module - the id only needs to be stable and
// collision-resistant for local de-duplication, not cryptographically secure.

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

/**
 * A small, fast, deterministic string hash (cyrb53), returned as a fixed-length hex string.
 * Stands in for the original's `md5(text)` - only used as a stable local id, never for anything
 * security-sensitive.
 */
function hashHex(text) {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hi = (h2 >>> 0).toString(16).padStart(8, "0");
  const lo = (h1 >>> 0).toString(16).padStart(8, "0");
  return hi + lo;
}

export function makeId(timestampIso) {
  return hashHex(String(timestampIso));
}

export function create(name, craftName) {
  const createdDate = new Date().toISOString();

  return {
    formatVersion: 1,
    logId: hashHex(`${name || ""}|${createdDate}`),
    name: name || craftName || "Tuning Log",
    craftName: craftName || "",
    createdDate,
    entries: [],
  };
}

/**
 * Flattens a flight log's system configuration (PID gains, filters, rates, etc.) into a readable
 * text block, both for display and as context given to the AI.
 */
export function buildConfigSummary(sysConfig) {
  const lines = [];
  const keys = Object.keys(sysConfig || {}).sort();

  for (const key of keys) {
    const value = sysConfig[key];

    if (value === null || value === undefined || typeof value === "function") {
      continue;
    }

    try {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } catch {
      // Skip values that can't be serialized
    }
  }

  return lines.join("\n");
}

/**
 * The flight log's own recorded start time (rather than whenever the user happened to click
 * "Capture") so the same flight log always produces the same timestamp/id, wherever it's captured
 * from - that keeps ids checkable/deduplicable against a given log.
 *
 * Flight controllers without an RTC report the header as "0000-01-01T00:00:00.000+00:00" instead
 * of omitting it, which parses as a valid (but useless) Date - that would otherwise make every
 * such log collide on the same id. When the header is missing or is that sentinel, fall back to
 * the originally-opened log file's `lastModified` timestamp (epoch ms, from the browser `File`
 * object - see appStore.logFileLastModified) - not a "created" time, since that would reset to
 * "now" when a log file is copied off an SD card, while last-modified survives the copy - and
 * finally to the current time if that isn't available either.
 */
export function logTimestamp(sysConfig, fileLastModified) {
  const raw = sysConfig && sysConfig["Log start datetime"];

  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() >= 2000) {
      return parsed.toISOString();
    }
  }

  if (fileLastModified) {
    const mtime = new Date(fileLastModified);
    if (!Number.isNaN(mtime.getTime())) {
      return mtime.toISOString();
    }
  }

  return new Date().toISOString();
}

/**
 * options: { image, config, notes, craftName, timestamp }
 */
export function addEntry(log, options) {
  const timestamp = options.timestamp || new Date().toISOString();

  const entry = {
    id: makeId(timestamp),
    timestamp,
    craftName: options.craftName || "",
    image: options.image,
    config: options.config || "",
    notes: options.notes || "",
  };

  if (options.ai) {
    entry.ai = options.ai;
  }

  log.entries.push(entry);

  return entry;
}

export function buildFilename(log) {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;

  const safeName = (log.name || "TuningLog").replace(/[^a-z0-9_-]+/gi, "_");

  return `RF_TUNING_LOG_${safeName}_${stamp}.json`;
}

/**
 * Returns an error message if `log` doesn't look like a tuning log file, or null if it's fine to
 * use. Guards against a user picking an unrelated JSON file (or a corrupted one) via Import -
 * without this, e.g. a `null` or non-object `entries` element would later throw when code
 * elsewhere dereferences it directly.
 */
export function validationError(log) {
  if (!log || typeof log !== "object" || Array.isArray(log)) {
    return "This file is not a tuning log.";
  }

  if (typeof log.formatVersion !== "number") {
    return "This file is not a tuning log.";
  }

  if (log.entries !== undefined) {
    if (!Array.isArray(log.entries)) {
      return 'This file is not a tuning log (its "entries" field is malformed).';
    }

    for (const entry of log.entries) {
      if (!entry || typeof entry !== "object") {
        return 'This file is not a tuning log (its "entries" field is malformed).';
      }
    }
  }

  return null;
}
