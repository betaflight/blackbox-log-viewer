/**
 * Pose → KML export — UI-facing entry point.
 *
 * STATUS: scaffold only. The body-pose reconstruction pipeline (ingestion →
 * ESKF forward pass → RTS smoother → resample → triad KML serializer) has NOT
 * been migrated into this TypeScript branch yet. This module exists so the
 * "Generate KML" button + modal + progress plumbing can be wired and exercised
 * end-to-end now. When the estimator lands, replace the marked section below;
 * the call contract, progress events, and download path already work.
 *
 * See planv5/12_roadmap.md (P-OPT-8 — port to TS once PR #925 merges).
 */

/** Thrown while the estimator backend is not yet migrated. */
export class PoseKmlNotImplemented extends Error {
  constructor(message = "Pose reconstruction backend not migrated yet (UI wired, estimator pending).") {
    super(message);
    this.name = "PoseKmlNotImplemented";
    this.code = "NOT_IMPLEMENTED";
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reconstruct the body-pose trajectory from a flight log and export it as a
 * georeferenced triad KML.
 *
 * @param {object}      opts
 * @param {object}      opts.flightLog          parsed FlightLog (from the log store)
 * @param {object|null} [opts.magModel]         parsed mag-calibration model JSON (schema 2.x) or null
 * @param {number}      [opts.triadsPerSecond]  body-axis triads emitted per second (default 2)
 * @param {(ev: { phase: string, fraction?: number, detail?: string }) => void} [opts.onProgress]
 * @param {AbortSignal} [opts.signal]           cancellation
 * @returns {Promise<{ filename: string, kml: string }>}
 */
export async function generatePoseKml({
  flightLog,
  magModel = null,
  triadsPerSecond = 2,
  onProgress,
  signal,
} = {}) {
  const report = (phase, fraction, detail) => onProgress?.({ phase, fraction, detail });
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException("Generation cancelled.", "AbortError");
  };

  // --- Input validation (real; this stays once the estimator is wired) ------
  if (!flightLog) throw new Error("No flight log is loaded.");
  if (!(triadsPerSecond > 0)) throw new Error("Triads per second must be greater than 0.");
  if (magModel != null && typeof magModel !== "object") {
    throw new Error("Mag model must be a parsed JSON object.");
  }

  report("parsing", 0, "Reading flight log…");
  await sleep(150);
  throwIfAborted();

  // === BACKEND NOT YET MIGRATED =============================================
  // When the pose modules are ported, replace everything below with roughly:
  //
  //   const data   = ingestFlightLog(flightLog, magModel);          // 03/05/08
  //   const origin = chooseOrigin(data);                            // 04 geodesy
  //   const track  = estimatePoseTrack(data, origin, { onProgress });   // 06 ESKF+RTS
  //   const track2 = resamplePoseTrack(track, triadsPerSecond);     // 11 delivery rate
  //   const kml    = poseTrackToKml(track2, { triadsPerSecond });   // 10 triad KML
  //   return { filename: `${baseName}_track.kml`, kml };
  //
  // The phases above already map onto the onProgress contract this UI consumes:
  //   parsing → estimating (iteration k/maxIter) → exporting.
  report("estimating", 0, "Estimator not yet migrated.");
  await sleep(150);
  throw new PoseKmlNotImplemented();
  // === END NOT-YET-MIGRATED =================================================
}
