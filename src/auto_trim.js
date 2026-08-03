import {
  FlightLogEvent,
  FLIGHT_LOG_GOVSTATES,
  FLIGHT_LOG_AIRBORNE_STATES,
} from "./flightlog_fielddefs.js";
import { setVideoInTime, setVideoOutTime } from "./video_handler.js";

/**
 * Auto Trim event selectors are persisted as plain strings so they're trivial to store/restore
 * and to bind directly to a <USelect>:
 *   "arm"                 - no dedicated blackbox event; stands in for the log's own start time
 *                           (blackbox logging normally starts right when armed)
 *   "disarm"               - a FlightLogEvent.DISARM event
 *   "govState:<name>"      - a FlightLogEvent.GOVERNOR_STATE event whose value is <name>
 *   "airborne:<name>"      - a FlightLogEvent.AIRBORNE_STATE event whose value is <name>
 * where <name> is one of the current log's FLIGHT_LOG_GOVSTATES / FLIGHT_LOG_AIRBORNE_STATES
 * entries (these differ by firmware version, so matching by name rather than raw numeric value
 * keeps a saved selector meaningful across logs).
 */
export function parseAutoTrimSelector(selector) {
  if (!selector) {
    return null;
  }
  if (selector === "arm" || selector === "disarm") {
    return { type: selector };
  }

  const separatorIndex = selector.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }
  const type = selector.slice(0, separatorIndex);
  const value = selector.slice(separatorIndex + 1);
  if (type !== "govState" && type !== "airborne") {
    return null;
  }
  return { type, value };
}

// Every event in the log, in chronological order, plus a synthetic leading "arm" event at the
// log's own start time (there's no dedicated blackbox event for arming).
export function getAllEventsForAutoTrim(flightLog) {
  const armEvent = {
    event: null,
    time: flightLog.getMinTime(),
    data: {},
    isArmEvent: true,
  };

  const chunks = flightLog.getChunksInTimeRange(flightLog.getMinTime(), flightLog.getMaxTime());
  const events = [armEvent];
  for (const chunk of chunks) {
    for (const event of chunk.events) {
      events.push(event);
    }
  }
  return events;
}

export function eventMatchesAutoTrimSelector(event, selector) {
  if (!selector) {
    return false;
  }

  switch (selector.type) {
    case "arm":
      return !!event.isArmEvent;
    case "disarm":
      return event.event === FlightLogEvent.DISARM;
    case "govState":
      return (
        event.event === FlightLogEvent.GOVERNOR_STATE &&
        FLIGHT_LOG_GOVSTATES[event.data.govState] === selector.value
      );
    case "airborne":
      return (
        event.event === FlightLogEvent.AIRBORNE_STATE &&
        FLIGHT_LOG_AIRBORNE_STATES[event.data.airborneState] === selector.value
      );
    default:
      return false;
  }
}

/**
 * If the "Auto Trim" setting is enabled, set the In/Out points (the same points controlled by
 * the I and O keys) to userSettings.autoTrimOffset seconds after the configured start event
 * through to userSettings.autoTrimOffset seconds before the following configured stop event.
 * Returns true if the trim was applied.
 */
export function applyAutoTrim(flightLog, userSettings) {
  if (!userSettings.autoTrim) {
    return false;
  }

  const startSelector = parseAutoTrimSelector(userSettings.autoTrimStartEvent);
  const stopSelector = parseAutoTrimSelector(userSettings.autoTrimStopEvent);
  const offset = (userSettings.autoTrimOffset || 0) * 1000000; // seconds -> microseconds

  const events = getAllEventsForAutoTrim(flightLog);

  let startEvent = false;
  let stopEvent = false;

  for (const event of events) {
    if (!startEvent) {
      if (eventMatchesAutoTrimSelector(event, startSelector)) {
        startEvent = event;
      }
    } else if (eventMatchesAutoTrimSelector(event, stopSelector)) {
      stopEvent = event;
      break;
    }
  }

  if (!startEvent || !stopEvent) {
    return false;
  }

  const inTime = startEvent.time + offset;
  const outTime = stopEvent.time - offset;

  if (outTime <= inTime) {
    return false;
  }

  setVideoInTime(inTime);
  setVideoOutTime(outTime);

  return true;
}
