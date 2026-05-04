import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useLogStore = defineStore("log", () => {
  const flightLog = ref(null);
  const flightLogDataArray = ref(null);
  const currentBlackboxTime = ref(0);
  const hasLog = ref(false);
  const hasVideo = ref(false);
  const videoURL = ref(false);

  const minTime = computed(() => flightLog.value?.getMinTime() ?? 0);
  const maxTime = computed(() => flightLog.value?.getMaxTime() ?? 0);

  function setFlightLog(log) {
    flightLog.value = log;
    hasLog.value = !!log;
  }

  function setFlightLogDataArray(dataArray) {
    flightLogDataArray.value = dataArray;
  }

  function setCurrentBlackboxTime(time) {
    currentBlackboxTime.value = time;
  }

  function setVideo(url) {
    videoURL.value = url;
    hasVideo.value = !!url;
  }

  return {
    flightLog,
    flightLogDataArray,
    currentBlackboxTime,
    hasLog,
    hasVideo,
    videoURL,
    minTime,
    maxTime,
    setFlightLog,
    setFlightLogDataArray,
    setCurrentBlackboxTime,
    setVideo,
  };
});
