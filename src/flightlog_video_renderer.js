import WebMWriter from "webm-writer";
import { FlightLogGrapher } from "./grapher";
import { triggerDownload } from "./tools.js";
import { useSettingsStore } from "./stores/settings.js";

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
export function FlightLogVideoRenderer(
  flightLog,
  logParameters,
  videoOptions,
  events,
) {
  const { userSettings } = useSettingsStore();

  let WORK_CHUNK_SIZE_FOCUSED = 8,
    WORK_CHUNK_SIZE_UNFOCUSED = 32,
    videoWriter,
    canvas = document.createElement("canvas"),
    stickCanvas = document.createElement("canvas"),
    craftCanvas = document.createElement("canvas"),
    analyserCanvas = document.createElement("canvas"),
    stickCanvasLeft,
    stickCanvasTop,
    craftCanvasLeft,
    craftCanvasTop,
    analyserCanvasLeft,
    analyserCanvasTop,
    canvasContext = canvas.getContext("2d"),
    frameCount,
    frameDuration /* Duration of a frame in Blackbox's microsecond time units */,
    frameTime,
    frameIndex,
    cancel = false,
    workChunkSize = WORK_CHUNK_SIZE_FOCUSED,
    hidden,
    visibilityChange,
    graph;

  // From https://developer.mozilla.org/en-US/docs/Web/Guide/User_experience/Using_the_Page_Visibility_API
  if (typeof document.hidden !== "undefined") {
    // Opera 12.10 and Firefox 18 and later support
    hidden = "hidden";
    visibilityChange = "visibilitychange";
  } else if (typeof document.mozHidden !== "undefined") {
    hidden = "mozHidden";
    visibilityChange = "mozvisibilitychange";
  } else if (typeof document.msHidden !== "undefined") {
    hidden = "msHidden";
    visibilityChange = "msvisibilitychange";
  } else if (typeof document.webkitHidden !== "undefined") {
    hidden = "webkitHidden";
    visibilityChange = "webkitvisibilitychange";
  }

  /**
   * Chrome slows down timers when the tab loses focus, so we want to fire fewer timer events (render more frames
   * in a chunk) in order to compensate.
   */
  function handleVisibilityChange() {
    if (document[hidden]) {
      workChunkSize = WORK_CHUNK_SIZE_UNFOCUSED;
    } else {
      workChunkSize = WORK_CHUNK_SIZE_FOCUSED;
    }
  }

  function installVisibilityHandler() {
    if (typeof document[hidden] !== "undefined") {
      document.addEventListener(
        visibilityChange,
        handleVisibilityChange,
        false,
      );
    }
  }

  function removeVisibilityHandler() {
    if (typeof document[hidden] !== "undefined") {
      document.removeEventListener(visibilityChange, handleVisibilityChange);
    }
  }

  function notifyCompletion(success, frameCount) {
    removeVisibilityHandler();

    if (events && events.onComplete) {
      events.onComplete(success, frameCount);
    }
  }

  function finishRender() {
    videoWriter.complete().then(function (webM) {
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
    let framesToRender = Math.min(workChunkSize, frameCount - frameIndex);

    if (cancel) {
      notifyCompletion(false);
      return;
    }

    let completeChunk = function () {
        if (events && events.onProgress) {
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

        if (logParameters.hasSticks && Number.parseInt(userSettings.sticks.size) > 0)
          canvasContext.drawImage(stickCanvas, stickCanvasLeft, stickCanvasTop);
        if (logParameters.hasCraft && Number.parseInt(userSettings.craft.size) > 0)
          canvasContext.drawImage(craftCanvas, craftCanvasLeft, craftCanvasTop);
        if (
          logParameters.hasAnalyser &&
          Number.parseInt(userSettings.analyser.size) > 0
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
      let renderFrames = function (frameCount) {
        if (frameCount == 0) {
          completeChunk();
          return;
        }

        logParameters.flightVideo.onseeked = function () {
          canvasContext.drawImage(
            logParameters.flightVideo,
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

        logParameters.flightVideo.currentTime =
          (frameTime - flightLog.getMinTime()) / 1000000 +
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

    frameTime = logParameters.inTime;
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
  if (videoOptions.videoDim >= 1.0) {
    delete logParameters.flightVideo;
  }

  let options = { ...userSettings, eraseBackground: !logParameters.flightVideo, drawEvents: false, fillBackground: !logParameters.flightVideo };

  graph = new FlightLogGrapher(
    flightLog,
    logParameters.graphConfig,
    canvas,
    stickCanvas,
    craftCanvas,
    analyserCanvas,
    options,
  );

  stickCanvasLeft = Number.parseInt(stickCanvas.style.left, 10) || 0;
  stickCanvasTop = Number.parseInt(stickCanvas.style.top, 10) || 0;

  craftCanvasLeft = Number.parseInt(craftCanvas.style.left, 10) || 0;
  craftCanvasTop = Number.parseInt(craftCanvas.style.top, 10) || 0;

  analyserCanvasLeft = Number.parseInt(analyserCanvas.style.left, 10) || 0;
  analyserCanvasTop = Number.parseInt(analyserCanvas.style.top, 10) || 0;

  if (!("inTime" in logParameters) || logParameters.inTime === false) {
    logParameters.inTime = flightLog.getMinTime();
  }

  if (!("outTime" in logParameters) || logParameters.outTime === false) {
    logParameters.outTime = flightLog.getMaxTime();
  }

  frameDuration = 1000000 / videoOptions.frameRate;

  // If the in -> out time is not an exact number of frames, we'll round the end time of the video to make it so:
  frameCount = Math.round(
    (logParameters.outTime - logParameters.inTime) / frameDuration,
  );

  if (logParameters.flightVideo) {
    logParameters.flightVideo.muted = true;
  }
}

/**
 * Is video rendering supported on this web browser? We require the ability to encode canvases to WebP.
 */
FlightLogVideoRenderer.isSupported = function () {
  let canvas = document.createElement("canvas");

  canvas.width = 16;
  canvas.height = 16;

  let encoded = canvas.toDataURL("image/webp", { quality: 0.9 });

  return encoded && encoded.match(/^data:image\/webp;/);
};
