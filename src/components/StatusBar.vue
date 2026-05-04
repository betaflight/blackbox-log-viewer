<template>
  <div class="flex items-center justify-between px-4 py-1 bg-neutral-100 dark:bg-neutral-900 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
    <div class="flex items-center gap-4">
      <span>{{ firmwareVersion }}</span>
      <span>{{ cells }}</span>
      <span>{{ loopTime }}</span>
      <span>{{ logRate }}</span>
      <span>{{ flightMode }}</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="font-mono">{{ markerOffset }}</span>

      <!-- Bookmarks -->
      <template v-for="n in 9" :key="n">
        <UButton
          v-if="workspaceStore.bookmarkTimes[n - 1] !== undefined"
          variant="ghost"
          color="primary"
          size="2xs"
          :label="String(n)"
          @click="$emit('goto-bookmark', n - 1)"
        />
      </template>

      <span>{{ viewerVersion }}</span>
    </div>
  </div>
</template>

<script setup>
import { useWorkspaceStore } from "../stores/workspace.js";

defineProps({
  firmwareVersion: { type: String, default: "-" },
  cells: { type: String, default: "-" },
  loopTime: { type: String, default: "-" },
  logRate: { type: String, default: "-" },
  flightMode: { type: String, default: "-" },
  markerOffset: { type: String, default: "00:00.000" },
  viewerVersion: { type: String, default: "-" },
});

defineEmits(["goto-bookmark"]);

const workspaceStore = useWorkspaceStore();
</script>
