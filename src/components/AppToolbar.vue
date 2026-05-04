<template>
  <nav class="flex items-center justify-between px-4 py-2 bg-neutral-900 text-white">
    <!-- Logo & filename -->
    <div class="flex items-center gap-3">
      <img src="/images/cf_logo_white.svg" alt="Betaflight" class="h-8" />
      <span class="font-semibold">Blackbox Explorer</span>
      <span v-if="logFilename" class="text-neutral-400 text-sm truncate max-w-64">
        {{ logFilename }}
      </span>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <template v-if="logStore.hasLog">
        <UButton
          variant="subtle"
          color="primary"
          label="Export CSV"
          icon="i-lucide-file-spreadsheet"
          size="xs"
          @click="$emit('export-csv')"
        />
        <UButton
          variant="subtle"
          color="primary"
          label="Export GPX"
          icon="i-lucide-map-pin"
          size="xs"
          @click="$emit('export-gpx')"
        />
      </template>
      <LogFileInput @files-selected="$emit('files-selected', $event)" />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-settings"
        @click="$emit('open-settings')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-keyboard"
        @click="$emit('open-keys')"
      />
    </div>
  </nav>
</template>

<script setup>
import { useLogStore } from "../stores/log.js";
import LogFileInput from "./LogFileInput.vue";

defineProps({
  logFilename: {
    type: String,
    default: "",
  },
});

defineEmits([
  "files-selected",
  "export-csv",
  "export-gpx",
  "open-settings",
  "open-keys",
]);

const logStore = useLogStore();
</script>
