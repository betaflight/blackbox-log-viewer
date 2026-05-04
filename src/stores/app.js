import { defineStore } from "pinia";
import { ref } from "vue";

export const useAppStore = defineStore("app", () => {
  const legendHidden = ref(false);
  const viewVideo = ref(true);

  // Filename of loaded log (pushed from legacy code)
  const logFilename = ref("");

  // Status bar display strings (pushed from legacy code)
  const statusVersion = ref("-");
  const statusCells = ref("");
  const statusLooptime = ref("-");
  const statusLograte = ref("-");
  const statusFlightMode = ref("-");
  const statusMarkerOffset = ref("00:00.000");
  const statusViewerVersion = ref("-");
  const graphTimeDisplay = ref("1.0");
  const videoOffsetDisplay = ref("+0.0");

  function setLegendHidden(hidden) {
    legendHidden.value = hidden;
  }

  function setViewVideo(visible) {
    viewVideo.value = visible;
  }

  return {
    legendHidden,
    viewVideo,
    logFilename,
    statusVersion,
    statusCells,
    statusLooptime,
    statusLograte,
    statusFlightMode,
    statusMarkerOffset,
    statusViewerVersion,
    graphTimeDisplay,
    videoOffsetDisplay,
    setLegendHidden,
    setViewVideo,
  };
});
