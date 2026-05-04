import { defineStore } from "pinia";
import { ref } from "vue";

const GRAPH_STATE_PAUSED = 0;
const GRAPH_STATE_PLAY = 1;
const PLAYBACK_MIN_RATE = 10;
const PLAYBACK_MAX_RATE = 300;
const PLAYBACK_DEFAULT_RATE = 100;
const PLAYBACK_RATE_STEP = 5;

export const usePlaybackStore = defineStore("playback", () => {
  const graphState = ref(GRAPH_STATE_PAUSED);
  const playbackRate = ref(PLAYBACK_DEFAULT_RATE);
  const videoOffset = ref(0.0);
  const videoExportInTime = ref(false);
  const videoExportOutTime = ref(false);

  const isPlaying = () => graphState.value === GRAPH_STATE_PLAY;
  const isPaused = () => graphState.value === GRAPH_STATE_PAUSED;

  function play() {
    graphState.value = GRAPH_STATE_PLAY;
  }

  function pause() {
    graphState.value = GRAPH_STATE_PAUSED;
  }

  function togglePlayPause() {
    graphState.value =
      graphState.value === GRAPH_STATE_PLAY
        ? GRAPH_STATE_PAUSED
        : GRAPH_STATE_PLAY;
  }

  function setPlaybackRate(rate) {
    playbackRate.value = Math.max(
      PLAYBACK_MIN_RATE,
      Math.min(PLAYBACK_MAX_RATE, rate),
    );
  }

  function setVideoOffset(offset) {
    videoOffset.value = offset;
  }

  return {
    graphState,
    playbackRate,
    videoOffset,
    videoExportInTime,
    videoExportOutTime,
    isPlaying,
    isPaused,
    play,
    pause,
    togglePlayPause,
    setPlaybackRate,
    setVideoOffset,
    GRAPH_STATE_PAUSED,
    GRAPH_STATE_PLAY,
    PLAYBACK_MIN_RATE,
    PLAYBACK_MAX_RATE,
    PLAYBACK_DEFAULT_RATE,
    PLAYBACK_RATE_STEP,
  };
});
