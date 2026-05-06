<template>
  <UApp>
    <div id="blackbox-app">
      <!-- Teleported into legacy DOM layout -->
      <Teleport to="#vue-welcome">
        <WelcomePage @files-selected="onFilesSelected" />
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
          @toggle-header="onToggleHeader"
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

      <Teleport to="#vue-speed-panel">
        <SpeedPanel @rate-change="onRateChange" />
      </Teleport>
      <Teleport to="#vue-zoom-panel">
        <ZoomPanel @zoom-change="onZoomChange" />
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
      <Teleport to="#vue-workspace-panel">
        <WorkspacePanel
          @switch-workspace="onSwitchWorkspace"
          @save-workspace="onSaveWorkspace"
          @apply-default="onApplyDefaultWorkspace"
        />
      </Teleport>

      <Teleport to="#vue-analyser">
        <SpectrumAnalyser />
      </Teleport>
      <Teleport to="#vue-legend-panel">
        <LegendPanel />
      </Teleport>
      <Teleport to="#vue-field-values">
        <FieldValuesPanel />
      </Teleport>
      <Teleport to="#vue-seekbar-toolbar">
        <SeekBarToolbar />
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
import { ref, watch } from "vue";
import AppToolbar from "./components/AppToolbar.vue";
import WelcomePage from "./components/WelcomePage.vue";
import ViewControls from "./components/ViewControls.vue";
import PlaybackControls from "./components/PlaybackControls.vue";
import TimePanel from "./components/TimePanel.vue";
import SpeedPanel from "./components/SpeedPanel.vue";
import ZoomPanel from "./components/ZoomPanel.vue";
import SyncPanel from "./components/SyncPanel.vue";
import WorkspacePanel from "./components/WorkspacePanel.vue";
import StatusBar from "./components/StatusBar.vue";
import GraphCanvas from "./components/GraphCanvas.vue";
import SeekBarCanvas from "./components/SeekBarCanvas.vue";
import KeysDialog from "./components/KeysDialog.vue";
import UserSettingsDialog from "./components/UserSettingsDialog.vue";
import GraphConfigDialog from "./components/GraphConfigDialog.vue";
import HeaderDialog from "./components/HeaderDialog.vue";
import VideoExportDialog from "./components/VideoExportDialog.vue";
import SpectrumAnalyser from "./components/SpectrumAnalyser.vue";
import LegendPanel from "./components/LegendPanel.vue";
import FieldValuesPanel from "./components/FieldValuesPanel.vue";
import SeekBarToolbar from "./components/SeekBarToolbar.vue";

const graphCanvasRef = ref(null);
const seekBarRef = ref(null);
const keysDialogOpen = ref(false);
const settingsDialogOpen = ref(false);
const graphConfigDialogOpen = ref(false);
const headerDialogOpen = ref(false);
const videoExportDialogOpen = ref(false);
const currentUserSettings = ref({});
const currentFlightLog = ref(null);
const currentGraphConfig = ref(null);
const currentSysConfig = ref(null);
const videoExportParams = ref(null);
const currentVideoConfig = ref(null);

function refreshLegacyState() {
  const legacy = getLegacy();
  currentUserSettings.value = globalThis.userSettings || {};
  currentFlightLog.value = legacy?.flightLog ?? null;
  currentGraphConfig.value = legacy?.activeGraphConfig ?? null;
  currentSysConfig.value = legacy?.flightLog?.getSysConfig?.() ?? null;
  videoExportParams.value = legacy?.getVideoExportParams?.() ?? null;
  currentVideoConfig.value = legacy?.videoConfig ?? null;
}

// Bridge helper — access legacy BlackboxLogViewer instance
function getLegacy() {
  return globalThis.blackboxLogViewer;
}

function onFilesSelected(files) {
  getLegacy()?.loadFiles(files);
}

function onOpenSettings() {
  refreshLegacyState();
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
  refreshLegacyState();
  videoExportDialogOpen.value = true;
}

function onExportWorkspaces() {
  getLegacy()?.exportWorkspaces?.();
}

function onNewWindow() {
  getLegacy()?.openNewWindow?.();
}

function onViewConfig() {
  headerDialogOpen.value = false;
  getLegacy()?.closeOverlays?.();
}

function onToggleHeader() {
  if (!headerDialogOpen.value) {
    refreshLegacyState();
    getLegacy()?.closeOverlays?.();
  }
  headerDialogOpen.value = !headerDialogOpen.value;
}

function onToggleTable() {
  headerDialogOpen.value = false;
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

function onRateChange(rate) {
  getLegacy()?.setPlaybackRate?.(rate);
}

function onZoomChange(zoom) {
  getLegacy()?.setGraphZoom?.(zoom);
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

function onSwitchWorkspace(id) {
  getLegacy()?.switchWorkspace?.(id);
}

function onSaveWorkspace(id, title) {
  getLegacy()?.saveWorkspace?.(id, title);
}

function onApplyDefaultWorkspace(index) {
  getLegacy()?.applyDefaultWorkspace?.(index);
}

function onGotoBookmark(index) {
  getLegacy()?.gotoBookmark?.(index + 1);
}

// Refresh legacy state when dialogs opened externally (e.g. from legacy JS)
watch(
  [graphConfigDialogOpen, headerDialogOpen, settingsDialogOpen, videoExportDialogOpen],
  (vals, prev) => {
    if (vals.some((v, i) => v && !prev[i])) { refreshLegacyState(); }
  },
);

// Expose for external access during migration
defineExpose({
  keysDialogOpen,
  settingsDialogOpen,
  graphConfigDialogOpen,
  headerDialogOpen,
  videoExportDialogOpen,
});
</script>
