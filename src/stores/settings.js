import { defineStore } from "pinia";
import { reactive, toRaw } from "vue";
import { defaultUserSettings } from "../user_settings_data.js";
import { PrefStorage } from "../pref_storage.js";

const prefs = new PrefStorage();

export const useSettingsStore = defineStore("settings", () => {
  const userSettings = reactive({ ...defaultUserSettings });

  function load() {
    prefs.get("userSettings", (item) => {
      if (item) {
        Object.assign(userSettings, defaultUserSettings, item);
      }
    });
  }

  function saveAll(newSettings) {
    Object.assign(userSettings, newSettings);
    prefs.set("userSettings", toRaw(userSettings));
  }

  function saveSetting(key, value) {
    userSettings[key] = value;
    prefs.get("userSettings", (data) => {
      const merged = data || {};
      merged[key] = value;
      prefs.set("userSettings", merged);
    });
  }

  // Load persisted settings on creation
  load();

  return {
    userSettings,
    load,
    saveAll,
    saveSetting,
  };
});
