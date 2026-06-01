import { throttle } from "throttle-debounce";
import pinia from "./pinia_instance.js";
import { useLogStore } from "./stores/log.js";
import { useGraphStore, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM } from "./stores/graph.js";
import { usePlaybackStore, GRAPH_STATE_PAUSED, GRAPH_STATE_PLAY, PLAYBACK_MIN_RATE, PLAYBACK_MAX_RATE } from "./stores/playback.js";
import { useAppStore } from "./stores/app.js";
import { useSettingsStore } from "./stores/settings.js";
import { FlightLogParser } from "./flightlog_parser.js";
import { blackboxTimeFromVideoTime, syncLogToVideo, setVideoTime, setVideoOffset } from "./video_handler.js";
import { updateValuesChart } from "./values_display.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;


const SMALL_JUMP_TIME = 100 * 1000;

let lastRenderTime: number | false = false;
let animationFrameIsQueued = false;
let updateValuesRateLimited: Loose = null;
let seekBarRepaintRateLimited: Loose = null;

function ensureThrottles() {
  if (!updateValuesRateLimited) {
    const logStore = useLogStore(pinia);
    const graphStore = useGraphStore(pinia);
    const appStore = useAppStore(pinia);
    const settingsStore = useSettingsStore(pinia);
    updateValuesRateLimited = throttle(250, () =>
      updateValuesChart(logStore, graphStore, appStore, settingsStore.userSettings),
    );
    seekBarRepaintRateLimited = throttle(200, () => graphStore.seekBar.repaint());
  }
}

export function animationLoop() {
  ensureThrottles();
  const now = Date.now();
  const graphStore = useGraphStore(pinia);
  const logStore = useLogStore(pinia);
  const playbackStore = usePlaybackStore(pinia);

  if (!graphStore.graph) {
    animationFrameIsQueued = false;
    return;
  }

  if (logStore.hasVideo) {
    logStore.currentBlackboxTime = blackboxTimeFromVideoTime();
  } else if (playbackStore.graphState === GRAPH_STATE_PLAY) {
    let delta;

    if (lastRenderTime === false) {
      delta = 0;
    } else {
      delta = Math.floor(
        ((now - lastRenderTime) * 1000 * playbackStore.playbackRate) / 100,
      );
    }

    logStore.currentBlackboxTime += delta;

    if (logStore.currentBlackboxTime > (logStore.flightLog as Loose).getMaxTime()) {
      logStore.currentBlackboxTime = (logStore.flightLog as Loose).getMaxTime();
      setGraphState(GRAPH_STATE_PAUSED);
    }
  }

  graphStore.graph.render(logStore.currentBlackboxTime);

  graphStore.seekBar.setCurrentTime(logStore.currentBlackboxTime);
  graphStore.seekBar.setWindow(graphStore.graph.getWindowWidthTime());

  if ((logStore.flightLog as Loose).hasGpsData()) {
    graphStore.mapGrapher.setCurrentTime(logStore.currentBlackboxTime);
  }

  updateValuesRateLimited();

  if (playbackStore.graphState === GRAPH_STATE_PLAY) {
    lastRenderTime = now;

    seekBarRepaintRateLimited();

    animationFrameIsQueued = true;
    requestAnimationFrame(animationLoop);
  } else {
    graphStore.seekBar.repaint();

    animationFrameIsQueued = false;
  }
}

export function invalidateGraph() {
  if (!animationFrameIsQueued) {
    animationFrameIsQueued = true;
    requestAnimationFrame(animationLoop);
  }
}

export function updateCanvasSize() {
  const graphStore = useGraphStore(pinia);
  const logStore = useLogStore(pinia);
  const canvas = graphStore.canvasRefs?.canvas;

  if (graphStore.graph && canvas) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    graphStore.graph.resize(width, height);
    graphStore.seekBar.resize(canvas.offsetWidth, 50);
    if ((logStore.flightLog as Loose).hasGpsData()) {
      graphStore.mapGrapher.resize(width, height);
    }

    invalidateGraph();
  }
}

export function setGraphState(newState: number) {
  const playbackStore = usePlaybackStore(pinia);
  const logStore = useLogStore(pinia);

  playbackStore.graphState = newState;
  lastRenderTime = false;

  switch (newState) {
    case GRAPH_STATE_PLAY:
      if (logStore.hasVideo) {
        playbackStore.videoElement!.play();
      }
      break;
    case GRAPH_STATE_PAUSED:
      if (logStore.hasVideo) {
        playbackStore.videoElement!.pause();
      }
      break;
  }

  invalidateGraph();
}

export function setCurrentBlackboxTime(newTime: number) {
  const logStore = useLogStore(pinia);
  const playbackStore = usePlaybackStore(pinia);

  if (logStore.hasVideo) {
    playbackStore.videoElement!.currentTime =
      (newTime - (logStore.flightLog as Loose).getMinTime()) / 1000000 + playbackStore.videoOffset;

    syncLogToVideo();
  } else {
    logStore.currentBlackboxTime = newTime;
  }

  invalidateGraph();
}

export function setPlaybackRate(rate: number) {
  const playbackStore = usePlaybackStore(pinia);
  if (rate >= PLAYBACK_MIN_RATE && rate <= PLAYBACK_MAX_RATE) {
    playbackStore.playbackRate = rate;

    if (playbackStore.videoElement) {
      playbackStore.videoElement!.playbackRate = rate / 100;
    }
  }
}

export function setGraphZoom(zoom: number | null) {
  const graphStore = useGraphStore(pinia);
  if (zoom == null) {
    zoom = graphStore.lastGraphZoom;
  }
  if (zoom >= GRAPH_MIN_ZOOM && zoom <= GRAPH_MAX_ZOOM) {
    graphStore.lastGraphZoom = graphStore.graphZoom;
    graphStore.graphZoom = zoom;

    if (graphStore.graph) {
      graphStore.graph.setGraphZoom(zoom / 100);
      invalidateGraph();
    }
  }
}

export function showConfigFile(state?: Loose) {
  const graphStore = useGraphStore(pinia);
  if (graphStore.hasConfig) {
    if (state == null) {
      graphStore.hasConfigOverlay = !graphStore.hasConfigOverlay;
    } else {
      graphStore.hasConfigOverlay = !!state;
    }
  }
}

export function showValueTable(state?: Loose) {
  const graphStore = useGraphStore(pinia);
  const logStore = useLogStore(pinia);
  const appStore = useAppStore(pinia);
  const settingsStore = useSettingsStore(pinia);

  if (state == null) {
    graphStore.hasTableOverlay = !graphStore.hasTableOverlay;
  } else {
    graphStore.hasTableOverlay = !!state;
  }
  updateValuesChart(logStore, graphStore, appStore, settingsStore.userSettings);
}

export function logJumpBack(fast?: Loose, slow?: Loose) {
  const logStore = useLogStore(pinia);
  const playbackStore = usePlaybackStore(pinia);
  const graphStore = useGraphStore(pinia);

  let scrollTime = SMALL_JUMP_TIME;
  if (fast != null) {
    scrollTime =
      fast === 0 ? scrollTime : graphStore.graph.getWindowWidthTime() * fast;
  }
  if (logStore.hasVideo) {
    if (slow) {
      scrollTime = (1 / 60) * 1000000;
    }
    setVideoTime(playbackStore.videoElement!.currentTime - scrollTime / 1000000);
  } else {
    const currentFrame = (logStore.flightLog as Loose).getCurrentFrameAtTime(
      logStore.currentBlackboxTime,
    );
    if (currentFrame?.previous && slow) {
      setCurrentBlackboxTime(
        currentFrame.previous[
          FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
        ],
      );
    } else {
      setCurrentBlackboxTime(logStore.currentBlackboxTime - scrollTime);
    }
  }

  setGraphState(GRAPH_STATE_PAUSED);
}

export function logJumpForward(fast?: Loose, slow?: Loose) {
  const logStore = useLogStore(pinia);
  const playbackStore = usePlaybackStore(pinia);
  const graphStore = useGraphStore(pinia);

  let scrollTime = SMALL_JUMP_TIME;
  if (fast != null) {
    scrollTime =
      fast === 0 ? scrollTime : graphStore.graph.getWindowWidthTime() * fast;
  }
  if (logStore.hasVideo) {
    if (slow) {
      scrollTime = (1 / 60) * 1000000;
    }
    setVideoTime(playbackStore.videoElement!.currentTime + scrollTime / 1000000);
  } else {
    const currentFrame = (logStore.flightLog as Loose).getCurrentFrameAtTime(
      logStore.currentBlackboxTime,
    );
    if (currentFrame?.next && slow) {
      setCurrentBlackboxTime(
        currentFrame.next[
          FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
        ],
      );
    } else {
      setCurrentBlackboxTime(logStore.currentBlackboxTime + scrollTime);
    }
  }

  setGraphState(GRAPH_STATE_PAUSED);
}

export function logJumpStart() {
  const logStore = useLogStore(pinia);
  setCurrentBlackboxTime((logStore.flightLog as Loose).getMinTime());
  setGraphState(GRAPH_STATE_PAUSED);
}

export function logJumpEnd() {
  const logStore = useLogStore(pinia);
  setCurrentBlackboxTime((logStore.flightLog as Loose).getMaxTime());
  setGraphState(GRAPH_STATE_PAUSED);
}

export function logPlayPause() {
  const playbackStore = usePlaybackStore(pinia);
  if (playbackStore.graphState === GRAPH_STATE_PAUSED) {
    setGraphState(GRAPH_STATE_PLAY);
  } else {
    setGraphState(GRAPH_STATE_PAUSED);
  }
}

export function logSyncHere() {
  const playbackStore = usePlaybackStore(pinia);
  setVideoOffset(playbackStore.videoElement!.currentTime, true);
}

export function logSyncBack() {
  const playbackStore = usePlaybackStore(pinia);
  setVideoOffset(playbackStore.videoOffset - 1 / 15, true);
}

export function logSyncForward() {
  const playbackStore = usePlaybackStore(pinia);
  setVideoOffset(playbackStore.videoOffset + 1 / 15, true);
}

export function setMarker(state: Loose) {
  const graphStore = useGraphStore(pinia);
  graphStore.hasMarker = state;
}

export function logSmartSync() {
  const logStore = useLogStore(pinia);
  const playbackStore = usePlaybackStore(pinia);
  const graphStore = useGraphStore(pinia);

  if (graphStore.hasMarker && logStore.hasVideo && logStore.hasLog) {
    try {
      setVideoOffset(
        playbackStore.videoOffset + (logStore.currentBlackboxTime - graphStore.markerTime) / 1000000,
        true,
      );
    } catch {
      console.log("Failed to set video offset");
    }
  }
  setMarker(!graphStore.hasMarker);
  invalidateGraph();
}

export function videoLoaded() {
  const logStore = useLogStore(pinia);
  logStore.hasVideo = true;
  setGraphState(GRAPH_STATE_PAUSED);
  invalidateGraph();
}
