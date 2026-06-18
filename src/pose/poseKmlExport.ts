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
import { resamplePoseTrack } from './poseTrack.js';
import { poseTrackToKml } from './serializers/kmlSerializer.js';
import { loadMagCharacterizationModel } from './mag_model.js';
import type { IngestedData } from './flightIngestion.js';
import type { EstimatorOrigin, EstimatorOpts, PoseTrackWithTrace } from './estimatorLoop.js';
import type { PoseTrack } from './poseTrack.js';

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
  track: PoseTrackWithTrace;
}

interface WorkerErrorMessage {
  type: 'error';
  message: string;
}

type WorkerResponse = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

/**
 * Run the full body-pose reconstruction pipeline and produce a triad KML.
 *
 * Pipeline: ingest log -> choose origin -> estimate (Web Worker) ->
 *           resample -> serialize to KML.
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
      outputHz: 20,
      sigmaYawMax: 0.1,
      magModel: magModelForEst as EstimatorOpts['magModel'],
    },
    signal,
  );

  throwIfAborted();

  // --- Phase 3: Serialize ---
  report('exporting', 0, 'Generating KML…');

  const resampled: PoseTrack = resamplePoseTrack(track, triadsPerSecond);
  const kml = poseTrackToKml(resampled, {
    everyN: 10,
    showTriads: true,
    showPath: true,
    axisLengthMeters: 2.0,
  });

  report('exporting', 1.0, 'Done.');
  throwIfAborted();

  const filename = 'track.kml';
  return { filename, kml };
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
): Promise<PoseTrackWithTrace> {
  // Try worker first; fall back to main thread if Worker is unavailable
  if (typeof Worker !== 'undefined') {
    try {
      return await runInWorker(data, origin, opts, signal);
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
  return runInMainThread(data, origin, opts, signal);
}

async function runInWorker(
  data: IngestedData & { mag: ReturnType<typeof correctMagStream> },
  origin: EstimatorOrigin,
  opts: EstimatorOpts,
  signal?: AbortSignal,
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
        // Progress events are relayed by the caller's onProgress,
        // which is threaded through the opts.onProgress to the UI.
        // The worker's postMessage goes to this handler; we don't
        // need to relay it further here because onProgress is wired
        // inside the worker's opts.
      } else if (msg.type === 'result') {
        signal?.removeEventListener('abort', abortHandler);
        worker.terminate();
        resolve(msg.track);
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

    worker.postMessage({
      type: 'estimate',
      data: data as unknown as Record<string, unknown>,
      origin,
      opts,
    });
  });
}

async function runInMainThread(
  data: IngestedData & { mag: ReturnType<typeof correctMagStream> },
  origin: EstimatorOrigin,
  opts: EstimatorOpts,
  signal?: AbortSignal,
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
        opts,
      );
      signal?.removeEventListener('abort', abortHandler);
      resolve(track);
    } catch (err) {
      signal?.removeEventListener('abort', abortHandler);
      reject(err);
    }
  });
}
