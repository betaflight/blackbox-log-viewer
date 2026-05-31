import { defineStore } from "pinia";
import { ref, shallowRef, computed } from "vue";
import type { FlightLog } from "../flightlog";
import {
  FIRMWARE_TYPE_BASEFLIGHT,
  FIRMWARE_TYPE_CLEANFLIGHT,
  FIRMWARE_TYPE_BETAFLIGHT,
  FIRMWARE_TYPE_INAV,
} from "../flightlog_fielddefs.js";

const FIRMWARE_CLASS_MAP: Record<number, string> = {
  [FIRMWARE_TYPE_BASEFLIGHT]: "isBaseF",
  [FIRMWARE_TYPE_CLEANFLIGHT]: "isCF",
  [FIRMWARE_TYPE_BETAFLIGHT]: "isBF",
  [FIRMWARE_TYPE_INAV]: "isINAV",
};

export const FIRMWARE_CLASSES = Object.values(FIRMWARE_CLASS_MAP);

export const useLogStore = defineStore("log", () => {
  const flightLog = ref<FlightLog | null>(null);
  const flightLogDataArray = ref<Uint8Array | null>(null);
  const currentBlackboxTime = ref(0);
  const hasLog = ref(false);
  const hasVideo = ref(false);
  const hasGps = computed(() => {
    // activeLogIndex dependency ensures re-evaluation when log index changes
    return activeLogIndex.value >= 0 && !!flightLog.value?.hasGpsData?.();
  });
  const videoURL = ref<string | null>(null);

  // Field values table data (updated by updateValuesChart in main.js)
  const fieldValues = shallowRef<Array<Record<string, unknown>>>([]);
  const fieldStats = shallowRef<Array<Record<string, unknown>>>([]);

  // Log index picker (multiple logs in one file)
  const logIndexEntries = shallowRef<Array<{ label: string; value: number; disabled?: boolean }>>([]);
  // Each: { label, value, disabled }
  const activeLogIndex = ref(0);

  const minTime = computed(() => flightLog.value?.getMinTime() ?? 0);
  const maxTime = computed(() => flightLog.value?.getMaxTime() ?? 0);

  const firmwareClass = computed(() => {
    const type = flightLog.value?.getSysConfig?.()?.firmwareType;
    return FIRMWARE_CLASS_MAP[type as number] ?? null;
  });

  function setFlightLog(log: FlightLog | null) {
    flightLog.value = log;
    hasLog.value = !!log;
  }

  function setFlightLogDataArray(dataArray: Uint8Array | null) {
    flightLogDataArray.value = dataArray;
  }

  function setCurrentBlackboxTime(time: number) {
    currentBlackboxTime.value = time;
  }

  function setVideo(url: string | null) {
    videoURL.value = url;
    hasVideo.value = !!url;
  }

  return {
    flightLog,
    flightLogDataArray,
    currentBlackboxTime,
    hasLog,
    hasVideo,
    hasGps,
    videoURL,
    fieldValues,
    fieldStats,
    logIndexEntries,
    activeLogIndex,
    minTime,
    maxTime,
    firmwareClass,
    setFlightLog,
    setFlightLogDataArray,
    setCurrentBlackboxTime,
    setVideo,
  };
});
