/**
 * Pose -> KML export — UI-facing entry point.
 *
 * Reconstructs the body-pose trajectory from a parsed flight log and exports it
 * as a georeferenced triad KML. Estimation runs in a Web Worker to keep the UI
 * responsive; progress events flow back to the caller's onProgress callback.
 *
 * Frame conventions:
 *  - Body: FRD (Forward=X, Right=Y, Down=Z)
 *  - World: NED (North, East, Down)
 *  - Quaternion: Hamilton, body(FRD) -> world(NED), scalar-first [w, x, y, z]
 */

import { ingestFlightLog, correctMagStream } from './flightIngestion.js';
import { createPoseTrack } from './poseTrack.js';
import { poseTrackToKml } from './serializers/kmlSerializer.js';
import { loadMagCharacterizationModel } from './mag_model.js';
import { computeMagHeadingBias } from './rawMagBias.js';
import type { IngestedData } from './flightIngestion.js';
import type { EstimatorOrigin, EstimatorOpts, PoseTrackWithTrace } from './estimatorLoop.js';
import type { PoseTrackMeta } from './poseTrack.js';
import type { PoseSampleInternal } from './poseSample.js';

export interface ProgressEvent {
  phase: 'parsing' | 'estimating' | 'exporting';
  iteration?: number;
  totalIterations?: number;
  fraction?: number;
  detail?: string;
}

export interface GeneratePoseKmlOpts {
  flightLog: unknown;
  magModel?: Record<string, unknown> | null;
  triadsPerSecond?: number;
  onProgress?: (ev: ProgressEvent) => void;
  signal?: AbortSignal;
}

export interface GeneratePoseKmlResult {
  filename: string;
  kml: string;
}

interface WorkerProgressMessage {
  type: 'progress';
  phase: string;
  iteration?: number;
  totalIterations?: number;
  fraction?: number;
  detail?: string;
}

interface WorkerResultMessage {
  type: 'result';
  meta: PoseTrackMeta;
  samples: PoseSampleInternal[];
}

interface WorkerErrorMessage {
  type: 'error';
  message: string;
}

type WorkerResponse = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

/** Estimator output rate (Hz). The flight PATH is rendered at this full
 *  resolution; "triads per second" only controls how often a triad is drawn. */
const OUTPUT_HZ = 20;

/**
 * Run the full body-pose reconstruction pipeline and produce a triad KML.
 *
 * Pipeline: ingest log -> choose origin -> estimate (Web Worker) ->
 *           serialize to KML (path at full resolution, triads at the requested
 *           density, raw GPS fixes overlaid for comparison).
 */
export async function generatePoseKml({
  flightLog,
  magModel = null,
  triadsPerSecond = 2,
  onProgress,
  signal,
}: GeneratePoseKmlOpts): Promise<GeneratePoseKmlResult> {
  const report = (phase: ProgressEvent['phase'], fraction?: number, detail?: string) => {
    onProgress?.({ phase, fraction, detail });
  };
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Generation cancelled.', 'AbortError');
  };

  // --- Input validation ---
  if (!flightLog) throw new Error('No flight log is loaded.');
  if (!(triadsPerSecond > 0)) throw new Error('Triads per second must be greater than 0.');
  if (magModel != null && typeof magModel !== 'object') {
    throw new Error('Mag model must be a parsed JSON object.');
  }

  // --- Phase 1: Parse & ingest ---
  report('parsing', 0, 'Reading flight log…');
  throwIfAborted();

  const data: IngestedData = ingestFlightLog(
    flightLog as Parameters<typeof ingestFlightLog>[0],
  );

  // Load and apply mag model
  let magGauss: ReturnType<typeof correctMagStream> = [];
  let magModelForEst: Record<string, unknown> | null = null;
  if (magModel) {
    const mr = loadMagCharacterizationModel(
      magModel as Parameters<typeof loadMagCharacterizationModel>[0],
    );
    if (mr.model) {
      magGauss = correctMagStream(
        data.mag,
        mr.model as Parameters<typeof correctMagStream>[1],
      );
      if (mr.model.fusion?.earthFieldNedGauss) {
        magModelForEst = mr.model as unknown as Record<string, unknown>;
      }
    }
  }

  // When no mag model was uploaded but raw mag data is present, compute a
  // model-free heading bias by fitting a hard-iron sphere and comparing the
  // tilt-compensated mag heading against the FC quaternion heading.  Passing
  // this bias into the estimator corrects the FC's sustained yaw offset
  // (~2-3° for a calibrated quad) without needing the wizard.
  let rawMagBiasRad = 0;
  if (!magModelForEst && data.mag.length > 0 && data.quat.length > 0) {
    const biasResult = computeMagHeadingBias(data.mag, data.quat);
    if (biasResult.valid) {
      rawMagBiasRad = biasResult.biasRad;
      console.log(`[MAG-BIAS] ${biasResult.message}`);
    } else {
      console.log(`[MAG-BIAS] ${biasResult.message}`);
    }
  }

  report('parsing', 1.0, 'Log parsed. Starting estimation…');
  throwIfAborted();

  // --- Choose origin ---
  // Use GPS home if available, otherwise first valid GPS fix.
  // For acro1, the drone was static at arm location so these are equivalent.
  const origin: EstimatorOrigin = data.gpsHome || {
    lat: data.gps[0]?.lat ?? 0,
    lon: data.gps[0]?.lon ?? 0,
    alt: data.gps[0]?.alt ?? 0,
  };

  const estimatorData = {
    ...data,
    mag: magGauss,
  };

  // --- Phase 2: Estimation (Web Worker) ---
  const track = await runEstimationInWorker(
    estimatorData,
    origin,
    {
      outputHz: OUTPUT_HZ,
      sigmaYawMax: 0.1,
      magModel: magModelForEst as EstimatorOpts['magModel'],
      rawMagBiasRad,
    },
    signal,
    onProgress,
  );

  throwIfAborted();

  // --- Phase 3: Serialize ---
  report('exporting', 0, 'Generating KML…');

  // The PATH is drawn at full estimation resolution (smooth). "Triads per
  // second" controls only triad density: at OUTPUT_HZ samples/s, draw a triad
  // every round(OUTPUT_HZ / triadsPerSecond) samples. Raw GPS fixes are
  // overlaid as a separate line so the fused track can be compared to them.
  const everyN = Math.max(1, Math.round(OUTPUT_HZ / triadsPerSecond));
  const kml = poseTrackToKml(track, {
    everyN,
    showTriads: true,
    showPath: true,
    showRawGps: true,
    rawGps: data.gps.map((g) => ({ lat: g.lat, lon: g.lon, alt: g.alt ?? 0 })),
    axisLengthMeters: 2.0,
  });

  report('exporting', 1.0, 'Done.');
  throwIfAborted();

  const filename = 'track.kml';
  return { filename, kml };
}

/**
 * Collapse the estimator's internal phases ('forward' / 'smooth' / 'done') —
 * whose fraction already advances 0->1 across the whole run — onto the public
 * 'estimating' phase, so the UI progress bar moves monotonically without
 * needing to know the estimator's internals.
 */
function toEstimatingEvent(ev: {
  phase?: string;
  iteration?: number;
  totalIterations?: number;
  fraction?: number;
  detail?: string;
}): ProgressEvent {
  return {
    phase: 'estimating',
    iteration: ev.iteration,
    totalIterations: ev.totalIterations,
    fraction: ev.fraction,
    detail: ev.detail,
  };
}

/**
 * Spawn a Web Worker to run the estimation. Bridges the worker's
 * postMessage progress events onto the caller's onProgress callback.
 *
 * Falls back to main-thread estimation if the worker cannot be created
 * (e.g., in test environments without DOM/Worker support).
 */
async function runEstimationInWorker(
  data: IngestedData & { mag: ReturnType<typeof correctMagStream> },
  origin: EstimatorOrigin,
  opts: EstimatorOpts,
  signal?: AbortSignal,
  onProgress?: (ev: ProgressEvent) => void,
): Promise<PoseTrackWithTrace> {
  // Try worker first; fall back to main thread if Worker is unavailable
  if (typeof Worker !== 'undefined') {
    try {
      return await runInWorker(data, origin, opts, signal, onProgress);
    } catch (err) {
      // If the worker fails to load (e.g., in vitest without DOM),
      // fall through to main-thread path.
      if (
        err instanceof Error &&
        (err.message.includes('Worker') || err.message.includes('import'))
      ) {
        console.warn(
          'Worker unavailable, running estimation in main thread.',
        );
      } else {
        throw err;
      }
    }
  }
  return runInMainThread(data, origin, opts, signal, onProgress);
}

async function runInWorker(
  data: IngestedData & { mag: ReturnType<typeof correctMagStream> },
  origin: EstimatorOrigin,
  opts: EstimatorOpts,
  signal?: AbortSignal,
  onProgress?: (ev: ProgressEvent) => void,
): Promise<PoseTrackWithTrace> {
  const worker = new Worker(new URL('./poseWorker.ts', import.meta.url), {
    type: 'module',
  });

  return new Promise((resolve, reject) => {
    const abortHandler = () => {
      worker.terminate();
      reject(new DOMException('Generation cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', abortHandler, { once: true });

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        // The onProgress function can't cross the worker boundary, so the
        // worker posts plain progress messages and we forward them here.
        onProgress?.(toEstimatingEvent(msg));
      } else if (msg.type === 'result') {
        signal?.removeEventListener('abort', abortHandler);
        worker.terminate();
        // sampleAt() is a function and cannot cross the worker boundary via
        // structuredClone. Rebuild the full PoseTrack on the main thread so
        // resamplePoseTrack() (which calls sampleAt()) works correctly.
        resolve(createPoseTrack({
          samples: msg.samples,
          georefOrigin: msg.meta.georefOrigin,
          source: msg.meta.source,
        }) as PoseTrackWithTrace);
      } else if (msg.type === 'error') {
        signal?.removeEventListener('abort', abortHandler);
        worker.terminate();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (err) => {
      signal?.removeEventListener('abort', abortHandler);
      worker.terminate();
      reject(new Error(err.message));
    };

    // Strip callbacks from opts before posting to the worker — functions
    // cannot be cloned by structuredClone (used internally by postMessage).
    // The worker uses its own onProgress that posts plain-data messages back.
    const safeOpts = { ...opts };
    delete (safeOpts as Record<string, unknown>).onProgress;

    // Dev-time clone-safety guard: verify the payload is serializable before
    // posting. A DataCloneError here means a non-cloneable value (function,
    // Symbol, DOM node) leaked into data/origin/opts.
    const inputPayload = { type: 'estimate', data, origin, opts: safeOpts };
    if (typeof structuredClone === 'function') {
      structuredClone(inputPayload);
    }
    worker.postMessage(inputPayload);
  });
}

async function runInMainThread(
  data: IngestedData & { mag: ReturnType<typeof correctMagStream> },
  origin: EstimatorOrigin,
  opts: EstimatorOpts,
  signal?: AbortSignal,
  onProgress?: (ev: ProgressEvent) => void,
): Promise<PoseTrackWithTrace> {
  // Dynamic import so the heavy estimator isn't bundled into the entry chunk
  const { estimatePoseTrack } = await import('./estimatorLoop.js');

  return new Promise((resolve, reject) => {
    const abortHandler = () => {
      reject(new DOMException('Generation cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', abortHandler, { once: true });

    try {
      const track = estimatePoseTrack(
        data as Parameters<typeof estimatePoseTrack>[0],
        origin,
        { ...opts, onProgress: onProgress ? (ev) => onProgress(toEstimatingEvent(ev)) : undefined },
      );
      signal?.removeEventListener('abort', abortHandler);
      resolve(track);
    } catch (err) {
      signal?.removeEventListener('abort', abortHandler);
      reject(err);
    }
  });
}
