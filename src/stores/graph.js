import { defineStore } from "pinia";
import { ref } from "vue";

const GRAPH_MIN_ZOOM = 1;
const GRAPH_MAX_ZOOM = 1000;
const GRAPH_DEFAULT_ZOOM = 100;

export const useGraphStore = defineStore("graph", () => {
  const graphConfig = ref(null);
  const activeGraphConfig = ref(null);
  const lastGraphConfig = ref(null);
  const graphZoom = ref(GRAPH_DEFAULT_ZOOM);
  const lastGraphZoom = ref(GRAPH_DEFAULT_ZOOM);

  const hasTable = ref(true);
  const hasTableOverlay = ref(false);
  const hasAnalyser = ref(false);
  const hasAnalyserFullscreen = ref(false);
  const hasAnalyserSticks = ref(false);
  const hasMap = ref(false);
  const hasMarker = ref(false);
  const hasConfig = ref(false);
  const hasConfigOverlay = ref(false);
  const isFullscreen = ref(false);
  const markerTime = ref(0);
  const seekBarMode = ref("avgThrottle");

  function setGraphZoom(zoom) {
    graphZoom.value = Math.max(GRAPH_MIN_ZOOM, Math.min(GRAPH_MAX_ZOOM, zoom));
  }

  function quickZoomToggle(newZoom) {
    if (graphZoom.value === newZoom) {
      setGraphZoom(lastGraphZoom.value);
    } else {
      lastGraphZoom.value = graphZoom.value;
      setGraphZoom(newZoom);
    }
  }

  return {
    graphConfig,
    activeGraphConfig,
    lastGraphConfig,
    graphZoom,
    lastGraphZoom,
    hasTable,
    hasTableOverlay,
    hasAnalyser,
    hasAnalyserFullscreen,
    hasAnalyserSticks,
    hasMap,
    hasMarker,
    hasConfig,
    hasConfigOverlay,
    isFullscreen,
    markerTime,
    seekBarMode,
    setGraphZoom,
    quickZoomToggle,
    GRAPH_MIN_ZOOM,
    GRAPH_MAX_ZOOM,
    GRAPH_DEFAULT_ZOOM,
  };
});
