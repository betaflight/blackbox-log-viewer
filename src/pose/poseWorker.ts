/**
 * Pose estimation Web Worker.
 *
 * Runs the heavy ESKF forward pass + RTS smoother off the main thread.
 * Receives already-ingested data (IngestedData), runs estimation,
 * and posts progress events and the final PoseTrack back to the main thread.
 *
 * Frame conventions:
 *  - Body: FRD (Forward=X, Right=Y, Down=Z)
 *  - World: NED (North, East, Down)
 *  - Quaternion: Hamilton, body(FRD) -> world(NED), scalar-first [w, x, y, z]
 */

import { estimatePoseTrack } from './estimatorLoop.js';
import type { EstimatorData, EstimatorOrigin, EstimatorOpts } from './estimatorLoop.js';
import type { PoseTrackWithTrace } from './estimatorLoop.js';

interface EstimateRequest {
  type: 'estimate';
  data: EstimatorData;
  origin: EstimatorOrigin;
  opts: EstimatorOpts;
}

interface ProgressMessage {
  type: 'progress';
  phase: string;
  iteration?: number;
  totalIterations?: number;
  fraction?: number;
  detail?: string;
}

interface ResultMessage {
  type: 'result';
  track: PoseTrackWithTrace;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type WorkerMessage = ProgressMessage | ResultMessage | ErrorMessage;

self.onmessage = async (e: MessageEvent<EstimateRequest>) => {
  if (e.data.type !== 'estimate') return;

  const { data, origin, opts } = e.data;

  const onProgress = (ev: {
    phase: string;
    iteration?: number;
    totalIterations?: number;
    fraction?: number;
    detail?: string;
  }) => {
    const msg: ProgressMessage = { type: 'progress', ...ev };
    self.postMessage(msg);
  };

  try {
    const track = estimatePoseTrack(data, origin, {
      ...opts,
      onProgress,
    });
    const msg: ResultMessage = { type: 'result', track };
    self.postMessage(msg);
  } catch (err) {
    const msg: ErrorMessage = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(msg);
  }
};
