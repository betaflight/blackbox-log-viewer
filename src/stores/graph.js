import { defineStore } from "pinia";
import { ref, shallowRef, computed } from "vue";
import { useSettingsStore } from "./settings.js";
import { useLogStore } from "./log.js";
import { PrefStorage } from "../pref_storage.js";

export const GRAPH_MIN_ZOOM = 1;
export const GRAPH_MAX_ZOOM = 1000;
export const GRAPH_DEFAULT_ZOOM = 100;

export const useGraphStore = defineStore("graph", () => {
  const prefs = new PrefStorage();

  // Renderer instances — registered by main.js after creation
  const graph = shallowRef(null);
  const mapGrapher = shallowRef(null);

  const graphConfig = ref(null);
  const activeGraphConfig = shallowRef(null);
  const lastGraphConfig = ref(null);
  const graphZoom = ref(GRAPH_DEFAULT_ZOOM);
  const lastGraphZoom = ref(GRAPH_DEFAULT_ZOOM);

  const hasTableOverlay = ref(false);
  const hasAnalyser = ref(false);
  const hasAnalyserFullscreen = ref(false);
  const hasAnalyserSticks = ref(false);
  const settingsStore = useSettingsStore();
  const hasCraft = computed(() => !!settingsStore.userSettings.drawCraft);
  const hasSticks = computed(() => !!settingsStore.userSettings.drawSticks);
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

  // Analyser
  const analyserLayout = shallowRef({ width: 0, height: 0, left: 0, top: 0 });
  const spectrumShiftActive = ref(false);
  const segmentLengthMax = ref(20);

  const isFullscreen = ref(false);
  const markerTime = ref(0);
  const seekBarMode = ref("avgThrottle");

  // Registered by main.js — queues a graph render frame
  const invalidateGraph = shallowRef(null);

  function toggleAnalyser() {
    if (activeGraphConfig.value?.selectedFieldName != null) {
      hasAnalyser.value = !hasAnalyser.value;
    } else {
      const graphs = activeGraphConfig.value?.getGraphs() ?? [];
      if (graphs.length === 0 || graphs[0].fields.length === 0) {
        hasAnalyser.value = false;
      } else {
        activeGraphConfig.value.selectedFieldName = graphs[0].fields[0].friendlyName;
        activeGraphConfig.value.selectedGraphIndex = 0;
        activeGraphConfig.value.selectedFieldIndex = 0;
        hasAnalyser.value = true;
      }
    }
    if (!hasAnalyser.value) {
      hasAnalyserFullscreen.value = false;
      graph.value?.setAnalyser(false);
    }
    graph.value?.setDrawAnalyser(hasAnalyser.value);
    prefs.set("hasAnalyser", hasAnalyser.value);
    invalidateGraph.value?.();
  }

  function toggleAnalyserFullscreen() {
    hasAnalyserFullscreen.value = hasAnalyser.value ? !hasAnalyserFullscreen.value : false;
    graph.value?.setAnalyser(hasAnalyserFullscreen.value);
    invalidateGraph.value?.();
  }

  function toggleMap() {
    hasMap.value = !hasMap.value;
    prefs.set("hasMap", hasMap.value);
    const logStore = useLogStore();
    if (logStore.flightLog?.hasGpsData()) {
      mapGrapher.value?.initialize();
    }
  }

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
    graph,
    mapGrapher,
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
    analyserLayout,
    spectrumShiftActive,
    segmentLengthMax,
    isFullscreen,
    markerTime,
    seekBarMode,
    invalidateGraph,
    toggleAnalyser,
    toggleAnalyserFullscreen,
    toggleMap,
    setGraphZoom,
    quickZoomToggle,
  };
});
