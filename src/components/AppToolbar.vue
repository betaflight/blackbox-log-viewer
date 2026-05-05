<template>
  <div>
    <!-- Logo bar -->
    <div class="flex items-center dark:bg-neutral-800 px-4 py-1">
      <div class="flex flex-col">
        <img src="/images/light-wide-2.svg" alt="Betaflight" class="h-7 w-auto" />
        <span class="text-[10px] text-neutral-400 -mt-0.5 pl-0.5">Blackbox Explorer</span>
      </div>
      <span v-if="appStore.logFilename" class="ml-auto text-[13px] text-neutral-300">
        {{ appStore.logFilename }}
      </span>
    </div>

    <!-- Action buttons row -->
    <div v-if="logStore.hasLog" class="app-action-bar">
      <div class="flex items-center gap-2">
        <UButton
          variant="soft"
          color="primary"
          label="New Window"
          icon="i-lucide-external-link"
          size="xs"
          @click="$emit('new-window')"
        />
        <UButton
          variant="soft"
          color="primary"
          label="Export video..."
          icon="i-lucide-video"
          size="xs"
          @click="$emit('export-video')"
        />
        <UButton
          variant="soft"
          color="primary"
          label="Export Workspaces..."
          icon="i-lucide-layout-grid"
          size="xs"
          @click="$emit('export-workspaces')"
        />
        <UButton
          variant="soft"
          color="primary"
          label="Export CSV..."
          icon="i-lucide-file-spreadsheet"
          size="xs"
          @click="$emit('export-csv')"
        />
        <UButton
          variant="soft"
          color="primary"
          label="Export GPX..."
          icon="i-lucide-map-pin"
          size="xs"
          @click="$emit('export-gpx')"
        />
      </div>
      <div class="flex items-center gap-2">
        <LogFileInput @files-selected="$emit('files-selected', $event)" />
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-settings"
          size="sm"
          title="User Settings"
          @click="$emit('open-settings')"
        />
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-keyboard"
          size="sm"
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
  "export-video",
  "export-workspaces",
  "new-window",
  "open-settings",
  "open-keys",
]);

const logStore = useLogStore();
const appStore = useAppStore();
</script>

<style>
.app-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px;
  background-color: var(--surface-100);
  border-bottom: 1px solid var(--border-color);
}
</style>
