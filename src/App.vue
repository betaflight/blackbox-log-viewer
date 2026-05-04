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
    </div>
  </UApp>
</template>

<script setup>
import { ref } from "vue";
import AppToolbar from "./components/AppToolbar.vue";
import WelcomePage from "./components/WelcomePage.vue";
import PlaybackControls from "./components/PlaybackControls.vue";
import StatusBar from "./components/StatusBar.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import SeekBarCanvas from "./components/SeekBarCanvas.vue";
import KeysDialog from "./components/KeysDialog.vue";

const graphCanvasRef = ref(null);
const seekBarRef = ref(null);
const keysDialogOpen = ref(false);

// Bridge helper — access legacy BlackboxLogViewer instance
function getLegacy() {
  return globalThis.blackboxLogViewer;
}

function onFilesSelected(files) {
  getLegacy()?.loadFiles(files);
}

function onOpenSettings() {
  // Legacy settings dialog uses Bootstrap modal
  document
    .querySelector(".open-user-settings-dialog")
    ?.dispatchEvent(new Event("click"));
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

// Expose for external access during migration
defineExpose({
  keysDialogOpen,
});
</script>
