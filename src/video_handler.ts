import pinia from "./pinia_instance.js";
import { useLogStore } from "./stores/log.js";
import { useGraphStore } from "./stores/graph.js";
import { usePlaybackStore } from "./stores/playback.js";
import { useAppStore } from "./stores/app.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;


export function blackboxTimeFromVideoTime() {
  const playbackStore = usePlaybackStore(pinia);
  const logStore = useLogStore(pinia);
  const video = playbackStore.videoElement!;
  return (video.currentTime - playbackStore.videoOffset) * 1000000 + (logStore.flightLog as Loose).getMinTime();
}

export function syncLogToVideo() {
  const logStore = useLogStore(pinia);
  if (logStore.hasLog) {
    logStore.currentBlackboxTime = blackboxTimeFromVideoTime();
  }
}

export function setVideoOffset(offset: number, withRefresh?: Loose) {
  const playbackStore = usePlaybackStore(pinia);
  const appStore = useAppStore(pinia);
  const graphStore = useGraphStore(pinia);

  playbackStore.videoOffset = offset;
  appStore.videoOffsetDisplay = (offset >= 0 ? "+" : "") + offset.toFixed(3);

  if (withRefresh) {
    graphStore.invalidateGraph?.();
  }
}

export function setVideoTime(newTime: number) {
  const playbackStore = usePlaybackStore(pinia);
  playbackStore.videoElement!.currentTime = newTime;
  syncLogToVideo();
}

export function setVideoInTime(inTime: number | null) {
  const playbackStore = usePlaybackStore(pinia);
  const graphStore = useGraphStore(pinia);

  playbackStore.videoExportInTime = inTime;
  graphStore.seekBar?.setInTime(inTime);

  if (graphStore.graph) {
    graphStore.graph.setInTime(inTime);
    graphStore.invalidateGraph?.();
  }
}

export function setVideoOutTime(outTime: number | null) {
  const playbackStore = usePlaybackStore(pinia);
  const graphStore = useGraphStore(pinia);

  playbackStore.videoExportOutTime = outTime;
  graphStore.seekBar?.setOutTime(outTime);

  if (graphStore.graph) {
    graphStore.graph.setOutTime(outTime);
    graphStore.invalidateGraph?.();
  }
}

export function loadVideo(file: File) {
  const playbackStore = usePlaybackStore(pinia);
  const logStore = useLogStore(pinia);

  playbackStore.currentOffsetCache.video = file.name;
  if (logStore.videoURL) {
    URL.revokeObjectURL(logStore.videoURL);
    logStore.videoURL = null;
  }

  if (!URL.createObjectURL) {
    alert(
      "Sorry, your web browser doesn't support showing videos from your local computer.",
    );
    playbackStore.currentOffsetCache.video = null;
    return;
  }

  logStore.videoURL = URL.createObjectURL(file);
  const video = playbackStore.videoElement!;
  video.volume = 1;
  video.src = logStore.videoURL;
  video.playbackRate = playbackStore.playbackRate / 100;
}

export function reportVideoError(e: Loose) {
  let errorMessage = "Error while loading the video.";
  if (e.currentTarget.error.code) {
    errorMessage += ` ERROR (${e.currentTarget.error.code}): ${e.currentTarget.error.message}`;
  }
  alert(errorMessage);
}
