import { defineStore } from "pinia";
import { ref } from "vue";

export const useAppStore = defineStore("app", () => {
  const legendHidden = ref(false);
  const viewVideo = ref(true);

  // Status bar display strings (pushed from legacy code)
  const statusVersion = ref("-");
  const statusCells = ref("");
  const statusLooptime = ref("-");
  const statusLograte = ref("-");
  const statusFlightMode = ref("-");
  const statusMarkerOffset = ref("00:00.000");
  const statusViewerVersion = ref("-");

  function setLegendHidden(hidden) {
    legendHidden.value = hidden;
  }

  function setViewVideo(visible) {
    viewVideo.value = visible;
  }

  return {
    legendHidden,
    viewVideo,
    statusVersion,
    statusCells,
    statusLooptime,
    statusLograte,
    statusFlightMode,
    statusMarkerOffset,
    statusViewerVersion,
    setLegendHidden,
    setViewVideo,
  };
});
