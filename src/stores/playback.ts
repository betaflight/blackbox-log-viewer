import { defineStore } from "pinia";
import { ref, shallowRef, computed } from "vue";

export const GRAPH_STATE_PAUSED = 0;
export const GRAPH_STATE_PLAY = 1;
export const PLAYBACK_MIN_RATE = 10;
export const PLAYBACK_MAX_RATE = 300;
export const PLAYBACK_DEFAULT_RATE = 100;
export const PLAYBACK_RATE_STEP = 5;

interface OffsetEntry {
  log: string | null;
  index: number | null;
  video: string | null;
  offset: number | null;
}

export const usePlaybackStore = defineStore("playback", () => {
  const graphState = ref(GRAPH_STATE_PAUSED);
  const playbackRate = ref(PLAYBACK_DEFAULT_RATE);
  const videoOffset = ref(0);
  const videoExportInTime = ref<number | null>(null);
  const videoExportOutTime = ref<number | null>(null);
  const videoConfig = ref({ width: 1280, height: 720, frameRate: 30, videoDim: 0.4 });

  // Video DOM element — registered by main.js
  const videoElement = shallowRef<HTMLVideoElement | null>(null);

  // Offset cache for auto-syncing video to log
  const offsetCache = shallowRef<OffsetEntry[]>([]);
  const currentOffsetCache = shallowRef<OffsetEntry>({ log: null, index: null, video: null, offset: null });

  const isPlaying = computed(() => graphState.value === GRAPH_STATE_PLAY);
  const isPaused = computed(() => graphState.value === GRAPH_STATE_PAUSED);

  // Callbacks registered by main.js (need video element + renderer closures)

  function setPlaybackRate(rate: number) {
    playbackRate.value = Math.max(
      PLAYBACK_MIN_RATE,
      Math.min(PLAYBACK_MAX_RATE, rate),
    );
  }

  function setVideoOffset(offset: number) {
    videoOffset.value = offset;
  }

  return {
    graphState,
    playbackRate,
    videoOffset,
    videoExportInTime,
    videoExportOutTime,
    videoConfig,
    videoElement,
    offsetCache,
    currentOffsetCache,
    isPlaying,
    isPaused,
    setPlaybackRate,
    setVideoOffset,
  };
});
