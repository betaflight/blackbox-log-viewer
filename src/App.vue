<template>
  <UApp>
    <div id="blackbox-app">
      <!--
        Phase 6: Activating Vue components incrementally.
        Components bridge to legacy BlackboxLogViewer via globalThis.blackboxLogViewer.
      -->
      <AppToolbar
        v-show="false"
        @files-selected="onFilesSelected"
        @open-settings="onOpenSettings"
        @open-keys="onOpenKeys"
        @export-csv="onExportCsv"
        @export-gpx="onExportGpx"
      />
      <WelcomePage v-show="false" />
      <PlaybackControls
        v-show="false"
        @jump-start="onJumpStart"
        @jump-end="onJumpEnd"
        @step-back="onStepBack"
        @step-forward="onStepForward"
      />
      <GraphCanvas v-show="false" ref="graphCanvasRef" />
      <SeekBarCanvas v-show="false" ref="seekBarRef" />
      <StatusBar v-show="false" />

      <!-- Dialogs -->
      <KeysDialog v-model:open="keysDialogOpen" />
      <UserSettingsDialog
        v-model:open="settingsDialogOpen"
        :settings="currentUserSettings"
        @save="onSaveSettings"
      />
      <GraphConfigDialog
        v-model:open="graphConfigDialogOpen"
        :flightLog="currentFlightLog"
        :graphConfig="currentGraphConfig"
        @save="onGraphConfigSave"
        @update="onGraphConfigUpdate"
      />
    </div>
  </UApp>
</template>

<script setup>
import { ref, computed } from "vue";
import AppToolbar from "./components/AppToolbar.vue";
import WelcomePage from "./components/WelcomePage.vue";
import PlaybackControls from "./components/PlaybackControls.vue";
import StatusBar from "./components/StatusBar.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import SeekBarCanvas from "./components/SeekBarCanvas.vue";
import KeysDialog from "./components/KeysDialog.vue";
import UserSettingsDialog from "./components/UserSettingsDialog.vue";
import GraphConfigDialog from "./components/GraphConfigDialog.vue";

const graphCanvasRef = ref(null);
const seekBarRef = ref(null);
const keysDialogOpen = ref(false);
const settingsDialogOpen = ref(false);
const graphConfigDialogOpen = ref(false);
const currentUserSettings = computed(() => globalThis.userSettings || {});
const currentFlightLog = computed(() => getLegacy()?.flightLog ?? null);
const currentGraphConfig = computed(() => getLegacy()?.activeGraphConfig ?? null);

// Bridge helper — access legacy BlackboxLogViewer instance
function getLegacy() {
  return globalThis.blackboxLogViewer;
}

function onFilesSelected(files) {
  getLegacy()?.loadFiles(files);
}

function onOpenSettings() {
  settingsDialogOpen.value = true;
}

function onOpenKeys() {
  keysDialogOpen.value = true;
}

function onExportCsv() {
  document
    .querySelector(".btn-csv-export")
    ?.dispatchEvent(new Event("click"));
}

function onExportGpx() {
  document
    .querySelector(".btn-gpx-export")
    ?.dispatchEvent(new Event("click"));
}

function onJumpStart() {
  document
    .querySelector(".log-jump-start")
    ?.dispatchEvent(new Event("click"));
}

function onJumpEnd() {
  document
    .querySelector(".log-jump-end")
    ?.dispatchEvent(new Event("click"));
}

function onStepBack() {
  document
    .querySelector(".log-jump-back")
    ?.dispatchEvent(new Event("click"));
}

function onStepForward() {
  document
    .querySelector(".log-jump-forward")
    ?.dispatchEvent(new Event("click"));
}

function onSaveSettings(newSettings) {
  // Delegate to legacy save handler which updates globalThis.userSettings,
  // persists to prefs, applies dark mode, and refreshes the graph
  getLegacy()?.saveUserSettings?.(newSettings);
}

function onGraphConfigSave(newConfig) {
  getLegacy()?.newGraphConfig?.(newConfig, true);
}

function onGraphConfigUpdate(newConfig) {
  getLegacy()?.newGraphConfig?.(newConfig, false);
}

// Expose for external access during migration
defineExpose({
  keysDialogOpen,
  settingsDialogOpen,
  graphConfigDialogOpen,
});
</script>
