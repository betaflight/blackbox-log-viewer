import { defineStore } from "pinia";
import { reactive, toRaw } from "vue";
import { defaultUserSettings } from "../user_settings_data.js";
import { PrefStorage } from "../pref_storage.js";

const prefs = new PrefStorage();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: Record<string, any>, source: Record<string, any>) {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv && typeof sv === "object" && !Array.isArray(sv) && target[key] && typeof target[key] === "object") {
      Object.assign(target[key], sv);
    } else {
      target[key] = sv;
    }
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const userSettings = reactive(structuredClone(defaultUserSettings));

  function load() {
    prefs.get("userSettings", (item: unknown) => {
      if (item) {
        const merged = structuredClone(defaultUserSettings);
        deepMerge(merged, item as Record<string, unknown>);
        Object.assign(userSettings, merged);
      }
    });
  }

  function saveAll(newSettings: Record<string, unknown>) {
    Object.assign(userSettings, newSettings);
    prefs.set("userSettings", toRaw(userSettings));
  }

  function saveSetting(key: string, value: unknown) {
    (userSettings as Record<string, unknown>)[key] = value;
    prefs.set("userSettings", { ...toRaw(userSettings) });
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
