import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

const GRAPH_MIN_ZOOM = 1;
const GRAPH_MAX_ZOOM = 1000;
const GRAPH_DEFAULT_ZOOM = 100;

export const useGraphStore = defineStore("graph", () => {
  const graphConfig = ref(null);
  const activeGraphConfig = ref(null);
  const lastGraphConfig = ref(null);
  const graphZoom = ref(GRAPH_DEFAULT_ZOOM);
  const lastGraphZoom = ref(GRAPH_DEFAULT_ZOOM);

  const hasTableOverlay = ref(false);
  const hasAnalyser = ref(false);
  const hasAnalyserFullscreen = ref(false);
  const hasAnalyserSticks = ref(false);
  const hasCraft = ref(false);
  const hasSticks = ref(false);
  const hasMap = ref(false);
  const hasMarker = ref(false);
  const hasConfig = ref(false);
  const hasConfigOverlay = ref(false);
  const configFileName = ref("");
  const configLines = shallowRef([]);

  // Legend
  const legendVisible = ref(true);
  const legendTitle = ref("Legend");
  const legendGraphs = shallowRef([]);
  // Each: { label, fields: [{ name, friendlyName, color, hidden }] }
  const legendValues = shallowRef({});
  // Map of fieldName → { value, settings }
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
    hasTableOverlay,
    hasAnalyser,
    hasAnalyserFullscreen,
    hasAnalyserSticks,
    hasCraft,
    hasSticks,
    hasMap,
    hasMarker,
    hasConfig,
    hasConfigOverlay,
    configFileName,
    configLines,
    legendVisible,
    legendTitle,
    legendGraphs,
    legendValues,
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
