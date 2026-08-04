import { defineStore } from "pinia";
import { ref, computed, toRaw } from "vue";
import { PrefStorage } from "../pref_storage.js";
import { triggerDownload } from "../tools.js";
import * as TuningLog from "../tuning_log.js";

const prefs = new PrefStorage();

export const useTuningLogStore = defineStore("tuningLog", () => {
  const currentLog = ref(null);
  const aiExpertMode = ref(false);
  const apiKeyBannerDismissed = ref(false);

  const hasLog = computed(() => currentLog.value !== null);
  const entries = computed(() => (currentLog.value ? currentLog.value.entries : []));
  const totalCostUsd = computed(() =>
    entries.value.reduce((sum, entry) => sum + ((entry.ai && entry.ai.costUsd) || 0), 0),
  );

  function persist() {
    prefs.set("tuningLog", currentLog.value ? toRaw(currentLog.value) : null);
  }

  function loadFromCache() {
    return new Promise((resolve) => {
      prefs.get("tuningLog", (item) => {
        currentLog.value = item || null;
        resolve();
      });
    });
  }

  function createLog(name, craftName) {
    currentLog.value = TuningLog.create(name, craftName);
    persist();
    return currentLog.value;
  }

  function closeLog() {
    currentLog.value = null;
    persist();
  }

  function findEntry(entryId) {
    return entries.value.find((entry) => entry.id === entryId) || null;
  }

  /**
   * options: { image, config, notes, craftName, timestamp }
   */
  function addEntry(options) {
    if (!currentLog.value) return null;

    const entry = TuningLog.addEntry(currentLog.value, options);
    persist();
    return entry;
  }

  function deleteEntry(entryId) {
    if (!currentLog.value) return;

    const index = currentLog.value.entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) return;

    currentLog.value.entries.splice(index, 1);
    persist();
  }

  function updateEntryNotes(entryId, notes) {
    const entry = findEntry(entryId);
    if (!entry) return;

    entry.notes = notes;
    persist();
  }

  /**
   * result: { model, conversation, costUsd } - costUsd is added to any cost already recorded for
   * this entry (a follow-up question adds to the running total, it doesn't replace it).
   */
  function setEntryAiResult(entryId, result) {
    const entry = findEntry(entryId);
    if (!entry) return;

    entry.ai = entry.ai || {};
    entry.ai.model = result.model;
    entry.ai.conversation = result.conversation;
    entry.ai.costUsd = (entry.ai.costUsd || 0) + (result.costUsd || 0);
    persist();
  }

  function importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        let log;
        try {
          log = JSON.parse(e.target.result);
        } catch {
          reject(new Error("This file is not valid JSON."));
          return;
        }

        const error = TuningLog.validationError(log);
        if (error) {
          reject(new Error(error));
          return;
        }

        log.entries = log.entries || [];

        currentLog.value = log;
        persist();
        resolve(currentLog.value);
      };

      reader.onerror = () => reject(new Error("Could not read file"));

      reader.readAsText(file);
    });
  }

  function exportToFile() {
    if (!currentLog.value) return;

    const raw = toRaw(currentLog.value);
    const filename = TuningLog.buildFilename(raw);
    triggerDownload(new Blob([JSON.stringify(raw, null, 2)], { type: "application/json" }), filename);
  }

  function setAiExpertMode(value) {
    aiExpertMode.value = value;
    prefs.set("tuningLogAiExpertMode", value);
  }

  function dismissApiKeyBanner() {
    apiKeyBannerDismissed.value = true;
    prefs.set("tuningLogApiKeyBannerDismissed", true);
  }

  // Restore the persisted tuning log and prefs as soon as the store is created.
  loadFromCache();
  prefs.get("tuningLogAiExpertMode", (value) => {
    aiExpertMode.value = !!value;
  });
  prefs.get("tuningLogApiKeyBannerDismissed", (value) => {
    apiKeyBannerDismissed.value = !!value;
  });

  return {
    currentLog,
    aiExpertMode,
    apiKeyBannerDismissed,
    hasLog,
    entries,
    totalCostUsd,
    createLog,
    closeLog,
    addEntry,
    deleteEntry,
    updateEntryNotes,
    setEntryAiResult,
    importFromFile,
    exportToFile,
    setAiExpertMode,
    dismissApiKeyBanner,
  };
});
