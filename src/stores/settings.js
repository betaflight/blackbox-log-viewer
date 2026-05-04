import { defineStore } from "pinia";
import { ref } from "vue";

export const useSettingsStore = defineStore("settings", () => {
  const userSettings = ref(null);
  const videoConfig = ref({});
  const offsetCache = ref([]);

  function setUserSettings(settings) {
    userSettings.value = settings;
  }

  function setVideoConfig(config) {
    videoConfig.value = config;
  }

  function setOffsetCache(cache) {
    offsetCache.value = cache;
  }

  return {
    userSettings,
    videoConfig,
    offsetCache,
    setUserSettings,
    setVideoConfig,
    setOffsetCache,
  };
});
