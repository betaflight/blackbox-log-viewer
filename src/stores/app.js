import { defineStore } from "pinia";
import { ref } from "vue";

export const useAppStore = defineStore("app", () => {
  const legendHidden = ref(false);
  const viewVideo = ref(true);

  function setLegendHidden(hidden) {
    legendHidden.value = hidden;
  }

  function setViewVideo(visible) {
    viewVideo.value = visible;
  }

  return {
    legendHidden,
    viewVideo,
    setLegendHidden,
    setViewVideo,
  };
});
