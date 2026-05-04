<template>
  <UApp>
    <div id="blackbox-app">
      <!--
        Phase 3: Vue component scaffolding.
        These components are rendered but hidden while the legacy jQuery UI
        is still active. They will be activated incrementally as we migrate
        each section of the UI.
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
      <!-- Phase 4: Canvas wrapper components -->
      <GraphCanvas v-show="false" ref="graphCanvasRef" />
      <SeekBarCanvas v-show="false" ref="seekBarRef" />
      <StatusBar v-show="false" />
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

const graphCanvasRef = ref(null);
const seekBarRef = ref(null);

// Event stubs — will bridge to legacy code or replace it
function onFilesSelected(files) {
  // TODO: bridge to legacy file loading
}

function onOpenSettings() {
  // TODO: bridge to legacy settings dialog
}

function onOpenKeys() {
  // TODO: bridge to legacy keys dialog
}

function onExportCsv() {
  // TODO: bridge to legacy CSV export
}

function onExportGpx() {
  // TODO: bridge to legacy GPX export
}

function onJumpStart() {
  // TODO: bridge to legacy jump-to-start
}

function onJumpEnd() {
  // TODO: bridge to legacy jump-to-end
}

function onStepBack() {
  // TODO: bridge to legacy step-back
}

function onStepForward() {
  // TODO: bridge to legacy step-forward
}
</script>
