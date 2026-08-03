import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { PrefStorage } from "../pref_storage.js";
import {
  emptyParsedCraftConfig,
  parseCraftConfigText,
  parseGearRatio,
} from "../craft_config.js";

const prefs = new PrefStorage();

export const useCraftConfigStore = defineStore("craftConfig", () => {
  const fileName = ref(null);
  const loadedAt = ref(null);
  const parsed = ref(emptyParsedCraftConfig());

  const hasConfig = computed(() => fileName.value !== null);
  const craftName = computed(() => parsed.value.craftName);
  const settings = computed(() => parsed.value.settings);
  const commands = computed(() => parsed.value.commands);
  const lines = computed(() => parsed.value.lines);
  const settingCount = computed(() => Object.keys(parsed.value.settings).length);

  // Motor RPM = main rotor RPM * this ratio, per `set main_rotor_gear_ratio = <a>,<b>` (ratio is
  // b/a). Tail rotor RPM = main rotor RPM * this ratio, per `set tail_rotor_gear_ratio = <a>,<b>`.
  const mainRotorGearRatio = computed(() =>
    parseGearRatio(parsed.value.settings.main_rotor_gear_ratio),
  );
  const tailRotorGearRatio = computed(() =>
    parseGearRatio(parsed.value.settings.tail_rotor_gear_ratio),
  );

  function persist() {
    prefs.set("craftConfig", {
      fileName: fileName.value,
      loadedAt: loadedAt.value,
      parsed: parsed.value,
    });
  }

  function loadFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        fileName.value = file.name;
        loadedAt.value = Date.now();
        parsed.value = parseCraftConfigText(e.target.result);

        persist();
        resolve();
      };

      reader.onerror = () => reject(new Error("Could not read file"));

      reader.readAsText(file);
    });
  }

  function loadFromCache() {
    return new Promise((resolve) => {
      prefs.get("craftConfig", (item) => {
        if (item) {
          fileName.value = item.fileName;
          loadedAt.value = item.loadedAt;
          parsed.value = item.parsed || emptyParsedCraftConfig();
        }
        resolve();
      });
    });
  }

  function clear() {
    fileName.value = null;
    loadedAt.value = null;
    parsed.value = emptyParsedCraftConfig();
    prefs.set("craftConfig", null);
  }

  // Restore the persisted craft dump/diff config, if any, as soon as the store is created.
  loadFromCache();

  return {
    fileName,
    loadedAt,
    hasConfig,
    craftName,
    settings,
    commands,
    lines,
    settingCount,
    mainRotorGearRatio,
    tailRotorGearRatio,
    loadFile,
    loadFromCache,
    clear,
  };
});
