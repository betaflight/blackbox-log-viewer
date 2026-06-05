import { defineStore } from "pinia";
import { ref, shallowRef, computed } from "vue";
import { useSettingsStore } from "./settings.js";
import { useLogStore } from "./log.js";
import { PrefStorage } from "../pref_storage.js";
import type { FlightLogGrapher } from "../grapher.js";
import type { SeekBar } from "../seekbar.js";
import type { MapGrapher } from "../graph_map.js";
import type { GraphConfig } from "../graph_config.js";
import type { GraphConfigList } from "../graph_types.js";

// The graph/field config arrays and legend value maps are free-form,
// user-editable structures; access stays loose. (The renderer instances
// themselves are now typed against their interfaces.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

interface LegendField {
  name: string;
  friendlyName: string;
  color: string;
  hidden: boolean;
}
interface LegendGraph {
  label: string;
  fields: LegendField[];
}

export const GRAPH_MIN_ZOOM = 1;
export const GRAPH_MAX_ZOOM = 1000;
export const GRAPH_DEFAULT_ZOOM = 100;

export const useGraphStore = defineStore("graph", () => {
  const prefs = new (PrefStorage as unknown as new () => PrefStorage)();

  // Renderer instances — registered by the composable after creation
  const graph = shallowRef<FlightLogGrapher | null>(null);
  const mapGrapher = shallowRef<MapGrapher | null>(null);
  const seekBar = shallowRef<SeekBar | null>(null);

  // Canvas DOM refs — registered by the composable
  const canvasRefs = shallowRef<Loose>(null);

  const graphConfig = ref<GraphConfigList | null>(null);
  const activeGraphConfig = shallowRef<GraphConfig | null>(null);
  const lastGraphConfig = ref<GraphConfigList | null>(null);
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
  const configLines = shallowRef<string[]>([]);

  // Legend
  const legendVisible = ref(true);
  const legendTitle = ref("Legend");
  const legendGraphs = shallowRef<LegendGraph[]>([]);
  // Each: { label, fields: [{ name, friendlyName, color, hidden }] }
  const legendValues = shallowRef<Record<string, Loose>>({});
  // Map of fieldName → { value, settings }

  // Analyser
  const analyserLayout = shallowRef({ width: 0, height: 0, left: 0, top: 0 });
  const spectrumShiftActive = ref(false);
  const segmentLengthMax = ref(20);

  const isFullscreen = ref(false);
  const markerTime = ref(0);
  const seekBarMode = ref("avgThrottle");

  // Callbacks registered by main.js
  const invalidateGraph = shallowRef<(() => void) | null>(null);
  const updateCanvasSize = shallowRef<(() => void) | null>(null);

  // --- Legend actions ---

  function buildLegendGraphs() {
    const cfg = activeGraphConfig.value;
    const graphs: Loose[] = cfg?.getGraphs() ?? [];
    legendGraphs.value = graphs.map((g: Loose, gi: number) => ({
      label: g.label,
      fields: g.fields.map((f: Loose, fi: number) => ({
        name: f.name,
        friendlyName: f.friendlyName,
        color: f.color,
        // cfg is non-null here: a non-empty `graphs` came from cfg.getGraphs().
        hidden: cfg!.isGraphFieldHidden(gi, fi),
      })),
    }));
  }

  function highlightLegendField(gi: number | null, fi: number | null) {
    if (!activeGraphConfig.value) {
      return;
    }
    activeGraphConfig.value.highlightGraphIndex = gi;
    activeGraphConfig.value.highlightFieldIndex = fi;
    invalidateGraph.value?.();
  }

  function selectLegendField(gi: number, fi: number, fieldName: string, ctrlKey: boolean) {
    if (!activeGraphConfig.value) {
      return;
    }
    const toggleAnalizer = activeGraphConfig.value.selectedFieldName === fieldName;
    const lockAnalyserHide = ctrlKey || graph.value?.hasMultiSpectrumAnalyser();
    if (toggleAnalizer) {
      hasAnalyser.value = lockAnalyserHide ? true : !hasAnalyser.value;
    } else {
      activeGraphConfig.value.selectedFieldName = fieldName;
      activeGraphConfig.value.selectedGraphIndex = gi;
      activeGraphConfig.value.selectedFieldIndex = fi;
      hasAnalyser.value = true;
    }
    // Hiding the analyser via the legend must also drop fullscreen (same as the
    // toolbar toggle), otherwise the fullscreen spectrum parameter controls
    // stay visible after the chart is gone.
    if (!hasAnalyser.value) {
      hasAnalyserFullscreen.value = false;
      graph.value?.setAnalyser(false);
    }
    graph.value?.setDrawAnalyser(hasAnalyser.value, ctrlKey);
    prefs.set("hasAnalyser", hasAnalyser.value);
    invalidateGraph.value?.();
  }

  function toggleLegendField(gi: number, fi: number) {
    if (!activeGraphConfig.value) {
      return;
    }
    activeGraphConfig.value.toggleGraphField(gi, fi);
    buildLegendGraphs();
    invalidateGraph.value?.();
  }

  function legendVisibilityChange(hidden: boolean) {
    prefs.set("log-legend-hidden", hidden);
    updateCanvasSize.value?.();
  }

  function toggleAnalyser() {
    if (activeGraphConfig.value?.selectedFieldName == null) {
      const graphs: Loose[] = activeGraphConfig.value?.getGraphs() ?? [];
      if (graphs.length === 0 || graphs[0].fields.length === 0) {
        hasAnalyser.value = false;
      } else {
        // Non-empty graphs implies activeGraphConfig.value is non-null.
        activeGraphConfig.value!.selectedFieldName = graphs[0].fields[0].friendlyName;
        activeGraphConfig.value!.selectedGraphIndex = 0;
        activeGraphConfig.value!.selectedFieldIndex = 0;
        hasAnalyser.value = true;
      }
    } else {
      hasAnalyser.value = !hasAnalyser.value;
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

  function setGraphZoom(zoom: number) {
    graphZoom.value = Math.max(GRAPH_MIN_ZOOM, Math.min(GRAPH_MAX_ZOOM, zoom));
  }

  function quickZoomToggle(newZoom: number) {
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
    seekBar,
    canvasRefs,
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
    updateCanvasSize,
    buildLegendGraphs,
    highlightLegendField,
    selectLegendField,
    toggleLegendField,
    legendVisibilityChange,
    toggleAnalyser,
    toggleAnalyserFullscreen,
    toggleMap,
    setGraphZoom,
    quickZoomToggle,
  };
});
