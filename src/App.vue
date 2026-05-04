<template>
  <UApp>
    <div id="blackbox-app">
      <!-- Teleported into legacy DOM layout -->
      <Teleport to="#vue-welcome">
        <WelcomePage />
      </Teleport>
      <Teleport to="#vue-navbar">
        <AppToolbar
          @files-selected="onFilesSelected"
          @open-settings="onOpenSettings"
          @open-keys="onOpenKeys"
          @export-csv="onExportCsv"
          @export-gpx="onExportGpx"
          @export-video="onExportVideo"
          @export-workspaces="onExportWorkspaces"
          @new-window="onNewWindow"
        />
      </Teleport>
      <Teleport to="#vue-statusbar">
        <StatusBar @goto-bookmark="onGotoBookmark" />
      </Teleport>

      <Teleport to="#vue-view-controls">
        <ViewControls
          @view-config="onViewConfig"
          @open-header="onOpenHeader"
          @toggle-table="onToggleTable"
          @toggle-video="onToggleVideo"
          @toggle-craft="onToggleCraft"
          @toggle-sticks="onToggleSticks"
          @toggle-analyser="onToggleAnalyser"
          @toggle-map="onToggleMap"
        />
      </Teleport>
      <Teleport to="#vue-playback">
        <PlaybackControls
          @jump-start="onJumpStart"
          @jump-end="onJumpEnd"
          @step-back="onStepBack"
          @step-forward="onStepForward"
          @play-pause="onPlayPause"
          @video-jump-start="onVideoJumpStart"
          @video-jump-end="onVideoJumpEnd"
        />
      </Teleport>

      <Teleport to="#vue-time-panel">
        <TimePanel @time-change="onTimeChange" />
      </Teleport>
      <Teleport to="#vue-sync-panel">
        <SyncPanel
          @sync-back="onSyncBack"
          @sync-forward="onSyncForward"
          @sync-here="onSyncHere"
          @smart-sync="onSmartSync"
          @offset-change="onOffsetChange"
        />
      </Teleport>

      <!-- Still hidden — kept for future phases -->
      <GraphCanvas v-show="false" ref="graphCanvasRef" />
      <SeekBarCanvas v-show="false" ref="seekBarRef" />

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
      <HeaderDialog
        v-model:open="headerDialogOpen"
        :sysConfig="currentSysConfig"
      />
      <VideoExportDialog
        v-model:open="videoExportDialogOpen"
        :flightLog="currentFlightLog"
        :logParameters="videoExportParams"
        :videoConfig="currentVideoConfig"
        @save-config="onSaveVideoConfig"
      />
    </div>
  </UApp>
</template>

<script setup>
import { ref, computed } from "vue";
import AppToolbar from "./components/AppToolbar.vue";
import WelcomePage from "./components/WelcomePage.vue";
import ViewControls from "./components/ViewControls.vue";
import PlaybackControls from "./components/PlaybackControls.vue";
import TimePanel from "./components/TimePanel.vue";
import SyncPanel from "./components/SyncPanel.vue";
import StatusBar from "./components/StatusBar.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import SeekBarCanvas from "./components/SeekBarCanvas.vue";
import KeysDialog from "./components/KeysDialog.vue";
import UserSettingsDialog from "./components/UserSettingsDialog.vue";
import GraphConfigDialog from "./components/GraphConfigDialog.vue";
import HeaderDialog from "./components/HeaderDialog.vue";
import VideoExportDialog from "./components/VideoExportDialog.vue";

const graphCanvasRef = ref(null);
const seekBarRef = ref(null);
const keysDialogOpen = ref(false);
const settingsDialogOpen = ref(false);
const graphConfigDialogOpen = ref(false);
const headerDialogOpen = ref(false);
const videoExportDialogOpen = ref(false);
const currentUserSettings = computed(() => globalThis.userSettings || {});
const currentFlightLog = computed(() => getLegacy()?.flightLog ?? null);
const currentGraphConfig = computed(() => getLegacy()?.activeGraphConfig ?? null);
const currentSysConfig = computed(() => getLegacy()?.flightLog?.getSysConfig?.() ?? null);
const videoExportParams = computed(() => getLegacy()?.getVideoExportParams?.() ?? null);
const currentVideoConfig = computed(() => getLegacy()?.videoConfig ?? null);

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
  getLegacy()?.exportCsv?.();
}

function onExportGpx() {
  getLegacy()?.exportGpx?.();
}

function onExportVideo() {
  getLegacy()?.pauseForExport?.();
  videoExportDialogOpen.value = true;
}

function onExportWorkspaces() {
  getLegacy()?.exportWorkspaces?.();
}

function onNewWindow() {
  getLegacy()?.openNewWindow?.();
}

function onViewConfig() {
  getLegacy()?.viewConfig?.();
}

function onOpenHeader() {
  headerDialogOpen.value = true;
}

function onToggleTable() {
  getLegacy()?.toggleTable?.();
}

function onToggleVideo() {
  getLegacy()?.toggleVideo?.();
}

function onToggleCraft() {
  getLegacy()?.toggleCraft?.();
}

function onToggleSticks() {
  getLegacy()?.toggleSticks?.();
}

function onToggleAnalyser() {
  getLegacy()?.toggleAnalyser?.();
}

function onToggleMap() {
  getLegacy()?.toggleMap?.();
}

function onSyncBack() {
  getLegacy()?.logSyncBack?.();
}

function onSyncForward() {
  getLegacy()?.logSyncForward?.();
}

function onSyncHere() {
  getLegacy()?.logSyncHere?.();
}

function onSmartSync() {
  getLegacy()?.logSmartSync?.();
}

function onOffsetChange(val) {
  getLegacy()?.setVideoOffsetValue?.(val);
}

function onTimeChange(timeStr) {
  getLegacy()?.setGraphTime?.(timeStr);
}

function onPlayPause() {
  getLegacy()?.logPlayPause?.();
}

function onJumpStart() {
  getLegacy()?.logJumpStart?.();
}

function onJumpEnd() {
  getLegacy()?.logJumpEnd?.();
}

function onStepBack() {
  getLegacy()?.logJumpBack?.();
}

function onStepForward() {
  getLegacy()?.logJumpForward?.();
}

function onVideoJumpStart() {
  getLegacy()?.videoJumpStart?.();
}

function onVideoJumpEnd() {
  getLegacy()?.videoJumpEnd?.();
}

function onSaveSettings(newSettings) {
  getLegacy()?.saveUserSettings?.(newSettings);
}

function onGraphConfigSave(newConfig) {
  getLegacy()?.newGraphConfig?.(newConfig, true);
}

function onGraphConfigUpdate(newConfig) {
  getLegacy()?.newGraphConfig?.(newConfig, false);
}

function onSaveVideoConfig(cfg) {
  getLegacy()?.saveVideoConfig?.(cfg);
}

function onGotoBookmark(index) {
  // Legacy bookmark navigation — dispatch click on the bookmark element
  document
    .querySelector(`.bookmark-${index + 1}`)
    ?.dispatchEvent(new Event("click"));
}

// Expose for external access during migration
defineExpose({
  keysDialogOpen,
  settingsDialogOpen,
  graphConfigDialogOpen,
  headerDialogOpen,
  videoExportDialogOpen,
});
</script>
