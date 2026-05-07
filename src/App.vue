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
          :header-active="appStore.headerDialogOpen"
          :table-active="graphStore.hasTableOverlay"
          :video-active="appStore.viewVideo"
          :craft-active="graphStore.hasCraft"
          :sticks-active="graphStore.hasSticks"
          :analyser-active="graphStore.hasAnalyser"
          :map-active="graphStore.hasMap"
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
      <FieldValuesPanel />
      <ConfigurationPanel />
      <Teleport to="#vue-seekbar-toolbar">
        <SeekBarToolbar />
      </Teleport>

      <!-- Dialogs -->
      <KeysDialog v-model:open="appStore.keysDialogOpen" />
      <UserSettingsDialog
        v-model:open="appStore.settingsDialogOpen"
        @save="onSaveSettings"
      />
      <GraphConfigDialog
        v-model:open="appStore.graphConfigDialogOpen"
        :flightLog="logStore.flightLog"
        :graphConfig="graphStore.activeGraphConfig"
        @save="onGraphConfigSave"
        @update="onGraphConfigUpdate"
      />
      <HeaderDialog
        v-model:open="appStore.headerDialogOpen"
        :sysConfig="sysConfig"
      />
      <VideoExportDialog
        v-model:open="appStore.videoExportDialogOpen"
        :flightLog="logStore.flightLog"
        :logParameters="videoExportParams"
        :videoConfig="playbackStore.videoConfig"
        @save-config="onSaveVideoConfig"
      />
    </div>
  </UApp>
</template>

<script setup>
import { ref, computed, watchEffect, onMounted, onUnmounted } from "vue";
import { useGraphStore } from "./stores/graph.js";
import { useAppStore } from "./stores/app.js";
import { useLogStore, FIRMWARE_CLASSES } from "./stores/log.js";
import { usePlaybackStore } from "./stores/playback.js";
import { useSettingsStore } from "./stores/settings.js";
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
import KeysDialog from "./components/KeysDialog.vue";
import UserSettingsDialog from "./components/UserSettingsDialog.vue";
import GraphConfigDialog from "./components/GraphConfigDialog.vue";
import HeaderDialog from "./components/HeaderDialog.vue";
import VideoExportDialog from "./components/VideoExportDialog.vue";
import SpectrumAnalyser from "./components/SpectrumAnalyser.vue";
import LegendPanel from "./components/LegendPanel.vue";
import FieldValuesPanel from "./components/FieldValuesPanel.vue";
import ConfigurationPanel from "./components/ConfigurationPanel.vue";
import SeekBarToolbar from "./components/SeekBarToolbar.vue";

const graphStore = useGraphStore();
const appStore = useAppStore();
const logStore = useLogStore();
const playbackStore = usePlaybackStore();
const settingsStore = useSettingsStore();

// Centralized CSS class binding — replaces 27 imperative html.classList calls in main.js
watchEffect(() => {
  const cl = document.documentElement.classList;
  cl.toggle("has-log", logStore.hasLog);
  cl.toggle("has-video", logStore.hasVideo);
  cl.toggle("has-gps", logStore.hasGps);
  cl.toggle("has-craft", graphStore.hasCraft);
  cl.toggle("has-sticks", graphStore.hasSticks);
  cl.toggle("has-analyser", graphStore.hasAnalyser);
  cl.toggle("has-analyser-fullscreen", graphStore.hasAnalyserFullscreen);
  cl.toggle("has-map", graphStore.hasMap);
  cl.toggle("has-marker", graphStore.hasMarker);
  cl.toggle("is-fullscreen", graphStore.isFullscreen);
  cl.toggle("video-hidden", !appStore.viewVideo);
  cl.toggle("has-expo-override", !!settingsStore.userSettings.graphExpoOverride);
  cl.toggle("has-smoothing-override", !!settingsStore.userSettings.graphSmoothOverride);
  cl.toggle("has-grid-override", !!settingsStore.userSettings.graphGridOverride);
  // Dark theme
  cl.toggle("dark", appStore.darkThemeEnabled);
  // Firmware type (map icon color filters)
  const fwClass = logStore.firmwareClass;
  for (const c of FIRMWARE_CLASSES) {
    cl.toggle(c, c === fwClass);
  }
});

// Derived state from stores
const sysConfig = computed(() => logStore.flightLog?.getSysConfig?.() ?? null);

// Video export params — built at dialog open time from store state
const videoExportParams = ref(null);

function getController() {
  return appStore.controller;
}

function onFilesSelected(files) {
  getController()?.loadFiles(files);
}

function onOpenSettings() {
  appStore.settingsDialogOpen = true;
}

function onOpenKeys() {
  appStore.keysDialogOpen = true;
}

function onExportCsv() {
  getController()?.exportCsv?.();
}

function onExportGpx() {
  getController()?.exportGpx?.();
}

function onExportVideo() {
  const ctrl = getController();
  ctrl?.pauseForExport?.();
  videoExportParams.value = ctrl?.getVideoExportParams?.() ?? null;
  appStore.videoExportDialogOpen = true;
}

function onExportWorkspaces() {
  getController()?.exportWorkspaces?.();
}

function onNewWindow() {
  getController()?.openNewWindow?.();
}

function onViewConfig() {
  appStore.headerDialogOpen = false;
  getController()?.closeOverlays?.();
}

function onToggleHeader() {
  if (!appStore.headerDialogOpen) {
    getController()?.closeOverlays?.();
  }
  appStore.headerDialogOpen = !appStore.headerDialogOpen;
}

function onToggleTable() {
  appStore.headerDialogOpen = false;
  getController()?.toggleTable?.();
}

function onToggleVideo() {
  getController()?.toggleVideo?.();
}

function onToggleCraft() {
  getController()?.toggleCraft?.();
}

function onToggleSticks() {
  getController()?.toggleSticks?.();
}

function onToggleAnalyser() {
  getController()?.toggleAnalyser?.();
}

function onToggleMap() {
  getController()?.toggleMap?.();
}

function onRateChange(rate) {
  getController()?.setPlaybackRate?.(rate);
}

function onZoomChange(zoom) {
  getController()?.setGraphZoom?.(zoom);
}

function onSyncBack() {
  getController()?.logSyncBack?.();
}

function onSyncForward() {
  getController()?.logSyncForward?.();
}

function onSyncHere() {
  getController()?.logSyncHere?.();
}

function onSmartSync() {
  getController()?.logSmartSync?.();
}

function onOffsetChange(val) {
  getController()?.setVideoOffsetValue?.(val);
}

function onTimeChange(timeStr) {
  getController()?.setGraphTime?.(timeStr);
}

function onPlayPause() {
  getController()?.logPlayPause?.();
}

function onJumpStart() {
  getController()?.logJumpStart?.();
}

function onJumpEnd() {
  getController()?.logJumpEnd?.();
}

function onStepBack() {
  getController()?.logJumpBack?.();
}

function onStepForward() {
  getController()?.logJumpForward?.();
}

function onVideoJumpStart() {
  getController()?.videoJumpStart?.();
}

function onVideoJumpEnd() {
  getController()?.videoJumpEnd?.();
}

function onSaveSettings(newSettings) {
  getController()?.saveUserSettings?.(newSettings);
}

function onGraphConfigSave(newConfig) {
  getController()?.newGraphConfig?.(newConfig, true);
}

function onGraphConfigUpdate(newConfig) {
  getController()?.newGraphConfig?.(newConfig, false);
}

function onSaveVideoConfig(cfg) {
  getController()?.saveVideoConfig?.(cfg);
}

function onSwitchWorkspace(id) {
  getController()?.switchWorkspace?.(id);
}

function onSaveWorkspace(id, title) {
  getController()?.saveWorkspace?.(id, title);
}

function onApplyDefaultWorkspace(index) {
  getController()?.applyDefaultWorkspace?.(index);
}

function onGotoBookmark(index) {
  getController()?.gotoBookmark?.(index + 1);
}

// Drag-and-drop file loading (window-level)
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
}
function onDrop(e) {
  e.preventDefault();
  const item = e.dataTransfer.items?.[0];
  const entry = item?.webkitGetAsEntry?.();
  if (entry?.isFile) {
    getController()?.loadFiles([e.dataTransfer.files[0]]);
  }
}
onMounted(() => {
  document.addEventListener("dragover", onDragOver);
  document.addEventListener("drop", onDrop);
});
onUnmounted(() => {
  document.removeEventListener("dragover", onDragOver);
  document.removeEventListener("drop", onDrop);
});
</script>
