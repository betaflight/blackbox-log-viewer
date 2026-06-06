import WebMWriter from "webm-writer";
import { FlightLogGrapher } from "./grapher";
import { triggerDownload } from "./tools.js";
import { useSettingsStore } from "./stores/settings.js";
import type { FlightLog } from "./flightlog";
import type { GraphConfig } from "./graph_config";

/**
 * Render a video of the given log using the given videoOptions (user video settings) and logParameters.
 *
 * flightLog - FlightLog object to render
 *
 * logParameters - Object with these fields:
 *     inTime      - Blackbox time code the video should start at, or false to start from the beginning
 *     outTime     - Blackbox time code the video should end at, or false to end at the end
 *     graphConfig - GraphConfig object to be used for drawing the graphs
 *     flightVideo - Flight video to display behind the graphs (optional)
 *     flightVideoOffset - Offset of flight video start time relative to start of log in seconds
 *
 * videoOptions - Object with these fields:
 *     frameRate
 *     width
 *     height
 *     videoDim   - Amount of dimming applied to background video from 0.0 to 1.0
 *
 * events - Object with these fields:
 *     onComplete - On render completion, called with (success, frameCount)
 *     onProgress - Called periodically with (frameIndex, frameCount) to report progress
 */
// The WebM writer, the vendored grapher construction and the vendor-prefixed
// document.hidden probes are genuinely dynamic; access there stays loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

/** User-chosen output video settings. */
export interface VideoOptions {
  width: number;
  height: number;
  frameRate: number;
  // Amount of dimming applied to the background video, 0.0–1.0.
  videoDim: number;
}

/** What and how to render (the selected range, overlays and optional video). */
export interface VideoLogParameters {
  // Time codes, or `false` to mean start-of-log / end-of-log (the renderer
  // resolves `false` against the flight log).
  inTime: number | false;
  outTime: number | false;
  graphConfig: GraphConfig;
  flightVideo?: HTMLVideoElement | null;
  flightVideoOffset?: number;
  hasCraft?: boolean;
  hasSticks?: boolean;
  hasAnalyser?: boolean;
}

/** Progress / completion callbacks. */
export interface VideoExportEvents {
  onComplete?: (success: boolean, frameCount?: number) => void;
  onProgress?: (frameIndex: number, frameCount: number) => void;
}

// Instance shape (the constructor's `this`). The value `FlightLogVideoRenderer`
// below is the constructor function (it also carries the static isSupported).
export interface FlightLogVideoRenderer {
  cancel(): void;
  start(): void;
  getWrittenSize(): number;
  willWriteDirectToDisk(): boolean;
}

export function FlightLogVideoRenderer(
  this: FlightLogVideoRenderer,
  flightLog: FlightLog,
  logParameters: VideoLogParameters,
  videoOptions: VideoOptions,
  events: VideoExportEvents,
) {
  const { userSettings } = useSettingsStore();

  const WORK_CHUNK_SIZE_FOCUSED = 8;
  const WORK_CHUNK_SIZE_UNFOCUSED = 32;
  let videoWriter: Loose;
  const canvas = document.createElement("canvas");
  const stickCanvas = document.createElement("canvas");
  const craftCanvas = document.createElement("canvas");
  const analyserCanvas = document.createElement("canvas");
  const canvasContext = canvas.getContext("2d")!;
  let frameTime: number;
  let frameIndex: number;
  let cancel = false;
  let workChunkSize = WORK_CHUNK_SIZE_FOCUSED;
  let hidden: string;
  let visibilityChange: string;

  // From https://developer.mozilla.org/en-US/docs/Web/Guide/User_experience/Using_the_Page_Visibility_API
  if (document.hidden !== undefined) {
    // Opera 12.10 and Firefox 18 and later support
    hidden = "hidden";
    visibilityChange = "visibilitychange";
  } else if ((document as Loose).mozHidden !== undefined) {
    hidden = "mozHidden";
    visibilityChange = "mozvisibilitychange";
  } else if ((document as Loose).msHidden !== undefined) {
    hidden = "msHidden";
    visibilityChange = "msvisibilitychange";
  } else if ((document as Loose).webkitHidden !== undefined) {
    hidden = "webkitHidden";
    visibilityChange = "webkitvisibilitychange";
  }

  /**
   * Chrome slows down timers when the tab loses focus, so we want to fire fewer timer events (render more frames
   * in a chunk) in order to compensate.
   */
  function handleVisibilityChange() {
    if ((document as Loose)[hidden]) {
      workChunkSize = WORK_CHUNK_SIZE_UNFOCUSED;
    } else {
      workChunkSize = WORK_CHUNK_SIZE_FOCUSED;
    }
  }

  function installVisibilityHandler() {
    if ((document as Loose)[hidden] !== undefined) {
      document.addEventListener(
        visibilityChange,
        handleVisibilityChange,
        false,
      );
    }
  }

  function removeVisibilityHandler() {
    if ((document as Loose)[hidden] !== undefined) {
      document.removeEventListener(visibilityChange, handleVisibilityChange);
    }
  }

  function notifyCompletion(success: boolean, frameCount?: number) {
    removeVisibilityHandler();

    if (events?.onComplete) {
      events.onComplete(success, frameCount);
    }
  }

  function finishRender() {
    videoWriter.complete().then(function (webM: Loose) {
      if (webM) {
        triggerDownload(webM, "video.webm");
      }

      notifyCompletion(true, frameIndex);
    });
  }

  function renderChunk() {
    /*
     * Allow the UI to have some time to run by breaking the work into chunks, yielding to the browser
     * between chunks.
     *
     * I'd dearly like to run the rendering process in a Web Worker, but workers can't use Canvas because
     * it happens to be a DOM element (and Workers aren't allowed access to the DOM). Stupid!
     */
    const framesToRender = Math.min(workChunkSize, frameCount - frameIndex);

    if (cancel) {
      notifyCompletion(false);
      return;
    }

    const completeChunk = function () {
        if (events?.onProgress) {
          events.onProgress(frameIndex, frameCount);
        }

        if (frameIndex >= frameCount) {
          finishRender();
        } else {
          setTimeout(renderChunk, 0);
        }
      },
      renderFrame = function () {
        graph.render(frameTime);

        if (logParameters.hasSticks && Number.parseInt(userSettings.sticks.size, 10) > 0)
          canvasContext.drawImage(stickCanvas, stickCanvasLeft, stickCanvasTop);
        if (logParameters.hasCraft && Number.parseInt(userSettings.craft.size, 10) > 0)
          canvasContext.drawImage(craftCanvas, craftCanvasLeft, craftCanvasTop);
        if (
          logParameters.hasAnalyser &&
          Number.parseInt(userSettings.analyser.size, 10) > 0
        )
          canvasContext.drawImage(
            analyserCanvas,
            analyserCanvasLeft,
            analyserCanvasTop,
          );

        videoWriter.addFrame(canvas);

        frameIndex++;
        frameTime += frameDuration;
      };

    if (logParameters.flightVideo) {
      const flightVideo = logParameters.flightVideo;
      const renderFrames = function (frameCount: number) {
        if (frameCount === 0) {
          completeChunk();
          return;
        }

        flightVideo.onseeked = function () {
          canvasContext.drawImage(
            flightVideo,
            0,
            0,
            videoOptions.width,
            videoOptions.height,
          );

          if (videoOptions.videoDim > 0) {
            canvasContext.fillStyle = `rgba(0,0,0,${videoOptions.videoDim})`;

            canvasContext.fillRect(0, 0, canvas.width, canvas.height);
          }

          // Render the normal graphs and add frame to video
          renderFrame();

          renderFrames(frameCount - 1);
        };

        flightVideo.currentTime =
          (frameTime - (flightLog.getMinTime() || 0)) / 1000000 +
          (logParameters.flightVideoOffset || 0);
      };

      renderFrames(framesToRender);
    } else {
      for (let i = 0; i < framesToRender; i++) {
        renderFrame();
      }

      completeChunk();
    }
  }

  /**
   * Attempt to cancel rendering sometime soon. An onComplete() event will be triggered with the 'success' parameter set
   * appropriately to report the outcome.
   */
  this.cancel = function () {
    cancel = true;
  };

  /**
   * Begin rendering the video and return immediately.
   */
  this.start = function () {
    cancel = false;

    frameTime = logParameters.inTime || 0;
    frameIndex = 0;

    installVisibilityHandler();

    videoWriter = new WebMWriter({
      frameRate: videoOptions.frameRate,
    });
    renderChunk();
  };

  /**
   * Get the number of bytes flushed out to the device so far.
   */
  this.getWrittenSize = function () {
    return videoWriter ? videoWriter.getWrittenSize() : 0;
  };

  /**
   * Returns true if the video can be saved directly to disk (bypassing memory caching).
   * Chrome Apps fileSystem API is removed — always returns false in PWA mode.
   */
  this.willWriteDirectToDisk = function () {
    return false;
  };

  canvas.width = videoOptions.width;
  canvas.height = videoOptions.height;

  // If we've asked to blank the flight video completely then just don't render that
  if (videoOptions.videoDim >= 1) {
    delete logParameters.flightVideo;
  }

  const options = { ...userSettings, eraseBackground: !logParameters.flightVideo, drawEvents: false, fillBackground: !logParameters.flightVideo };

  const graph = new (FlightLogGrapher as Loose)(
    flightLog,
    logParameters.graphConfig,
    canvas,
    stickCanvas,
    craftCanvas,
    analyserCanvas,
    options,
  );

  const stickCanvasLeft = Number.parseInt(stickCanvas.style.left, 10) || 0;
  const stickCanvasTop = Number.parseInt(stickCanvas.style.top, 10) || 0;

  const craftCanvasLeft = Number.parseInt(craftCanvas.style.left, 10) || 0;
  const craftCanvasTop = Number.parseInt(craftCanvas.style.top, 10) || 0;

  const analyserCanvasLeft = Number.parseInt(analyserCanvas.style.left, 10) || 0;
  const analyserCanvasTop = Number.parseInt(analyserCanvas.style.top, 10) || 0;

  if (!("inTime" in logParameters) || logParameters.inTime === false) {
    logParameters.inTime = flightLog.getMinTime();
  }

  if (!("outTime" in logParameters) || logParameters.outTime === false) {
    logParameters.outTime = flightLog.getMaxTime();
  }

  const frameDuration = 1000000 / videoOptions.frameRate;

  // If the in -> out time is not an exact number of frames, we'll round the end time of the video to make it so:
  const frameCount = Math.round(
    ((logParameters.outTime || 0) - (logParameters.inTime || 0)) / frameDuration,
  );

  if (logParameters.flightVideo) {
    logParameters.flightVideo.muted = true;
  }
}

/**
 * Is video rendering supported on this web browser? We require the ability to encode canvases to WebP.
 */
FlightLogVideoRenderer.isSupported = function (): boolean {
  const canvas = document.createElement("canvas");

  canvas.width = 16;
  canvas.height = 16;

  // Pre-existing call shape: toDataURL's quality arg is given an object here
  // (kept verbatim); cast keeps it type-clean.
  const encoded = canvas.toDataURL("image/webp", { quality: 0.9 } as Loose);

  return Boolean(encoded && /^data:image\/webp;/.exec(encoded));
};
