<template>
  <div>
    <!-- Logo bar with amber accent bottom border -->
    <div class="toolbar-logo">
      <div class="flex items-center gap-2">
        <img src="/images/light-wide-2.svg" alt="Betaflight" class="toolbar-logo-img" />
        <span class="toolbar-logo-subtitle">Blackbox Explorer</span>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="appStore.logFilename" class="toolbar-filename" :title="appStore.logFilename">
          {{ appStore.logFilename }}
        </span>
        <LogFileInput size="xs" @files-selected="$emit('files-selected', $event)" />
      </div>
    </div>

    <!-- Action buttons row -->
    <div v-if="logStore.hasLog" class="toolbar-actions">
      <div class="flex items-center gap-1">
        <UButton
          variant="ghost"
          color="neutral"
          label="New Window"
          icon="i-lucide-external-link"
          size="xs"
          @click="$emit('new-window')"
        />
        <USeparator orientation="vertical" class="h-4" />
        <UButton
          variant="ghost"
          color="neutral"
          label="Video"
          icon="i-lucide-video"
          size="xs"
          @click="$emit('export-video')"
        />
        <UButton
          variant="ghost"
          color="neutral"
          label="Workspaces"
          icon="i-lucide-layout-grid"
          size="xs"
          @click="$emit('export-workspaces')"
        />
        <UButton
          variant="ghost"
          color="neutral"
          label="CSV"
          icon="i-lucide-file-spreadsheet"
          size="xs"
          @click="$emit('export-csv')"
        />
        <UButton
          variant="ghost"
          color="neutral"
          label="GPX"
          icon="i-lucide-map-pin"
          size="xs"
          @click="$emit('export-gpx')"
        />
        <UButton
          variant="ghost"
          color="neutral"
          label="KML"
          icon="i-lucide-globe"
          size="xs"
          @click="$emit('export-kml')"
        />
      </div>
      <div class="flex items-center gap-1">
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-settings"
          size="xs"
          title="User Settings"
          @click="$emit('open-settings')"
        />
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-keyboard"
          size="xs"
          title="Keyboard Shortcuts"
          @click="$emit('open-keys')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useLogStore } from "../stores/log.js";
import { useAppStore } from "../stores/app.js";
import LogFileInput from "./LogFileInput.vue";

defineEmits([
  "files-selected",
  "export-csv",
  "export-gpx",
  "export-kml",
  "export-video",
  "export-workspaces",
  "new-window",
  "open-settings",
  "open-keys",
]);

const logStore = useLogStore();
const appStore = useAppStore();
</script>

<style scoped>
.toolbar-logo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.75rem;
  background: hsl(0, 0%, 12%);
  border-bottom: 2px solid var(--color-primary-500, #ffbb00);
}

.toolbar-logo-img {
  height: 1.5rem;
  width: auto;
  filter: brightness(0) invert(1);
}

.toolbar-logo-subtitle {
  font-size: 0.65rem;
  font-weight: 300;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-primary-500, #ffbb00);
}

.toolbar-filename {
  font-size: 0.7rem;
  color: hsl(0, 0%, 60%);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.2rem 0.75rem;
  background: var(--surface-100, hsl(0, 0%, 95%));
  border-bottom: 1px solid var(--border-color, #ccc);
}

:root.dark .toolbar-actions {
  background: var(--surface-200, hsl(0, 0%, 12%));
  border-bottom-color: var(--surface-800, hsl(0, 0%, 25%));
}
</style>
