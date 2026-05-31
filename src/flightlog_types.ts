// Shared types for the flight-log parser and FlightLog. Kept intentionally
// loose where the JS treats values dynamically (sysConfig is populated by
// string-keyed header handlers), and precise where consumers rely on it.

/**
 * System configuration parsed from the log header. Handlers assign by dynamic
 * string key, so an index signature is required; the fields consumers read by
 * name are declared explicitly for type safety.
 */
export interface SysConfig {
  // Header handlers populate sysConfig by dynamic string key, and several read
  // back chained (e.g. sysConfig[fn][0], sysConfig.rollPID.push). This mirrors
  // the original dynamically-typed JS; the hot fields below are typed precisely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;

  frameIntervalI: number;
  frameIntervalPNum: number;
  frameIntervalPDenom: number;
  firmwareType: number;
  firmwareVersion: string;
  minthrottle: number;
  vbatref: number;
}

/** Definition of a single frame type (I/P/G/H/S), parsed from "Field X ..." headers. */
export interface FrameDef {
  name: string[];
  nameToIndex: Record<string, number>;
  count: number;
  signed: number[];
  predictor: number[];
  encoding: number[];
}

/** Map of frame-type marker (e.g. "I", "P", "G", "H", "S") to its definition. */
export type FrameDefs = Record<string, FrameDef>;

/** Per-field min/max statistics. */
export interface FieldStat {
  min: number;
  max: number;
}

/** Statistics accumulated per frame type. */
export interface FrameTypeStats {
  bytes: number;
  sizeCount: Int32Array;
  validCount: number;
  corruptCount: number;
  desyncCount: number;
  field: FieldStat[];
}

/** Overall parse statistics. */
export interface Stats {
  totalBytes: number;
  totalCorruptFrames: number;
  intentionallyAbsentIterations: number;
  frame: Record<string, FrameTypeStats>;
}

/** Decoded log event (E frames). `data` shape depends on the event type. */
export interface FlightLogEventData {
  event: number;
  time?: number;
  // Event payload is event-type-specific and assigned dynamically by name.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

/** A decoded main/GPS/slow frame is an array of field values. */
export type FrameArray = number[];

/**
 * A cached block of decoded, time-aligned frames (with computed fields injected
 * on demand). Several fields are added/removed dynamically during processing.
 */
export interface FlightLogChunk {
  index: number;
  frames: number[][];
  gapStartsHere: Record<number, boolean>;
  events: FlightLogEventData[];
  initialIMU?: unknown;
  hasAdditionalFields?: boolean;
  needsEventTimes?: boolean;
}

/**
 * Callback invoked when a frame has been decoded.
 * (frameValid, frame, frameType, frameOffset, frameSize)
 */
export type OnFrameReady = (
  frameValid: boolean,
  // Polymorphic: a numeric frame, a decoded event object, or null — consumers
  // discriminate by frameType. Kept loose to match the dynamic JS callers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  frame: any,
  frameType: string,
  frameOffset: number,
  frameSize: number,
) => void;
