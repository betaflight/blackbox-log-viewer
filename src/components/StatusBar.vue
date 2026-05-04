<template>
  <div class="flex items-center justify-between px-4 py-1 bg-neutral-100 dark:bg-neutral-900 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
    <div class="flex items-center gap-4">
      <span>{{ appStore.statusVersion }}</span>
      <span v-if="appStore.statusCells">{{ appStore.statusCells }}</span>
      <span>{{ appStore.statusLooptime }}</span>
      <span>{{ appStore.statusLograte }}</span>
      <span>{{ appStore.statusFlightMode }}</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="font-mono">{{ appStore.statusMarkerOffset }}</span>

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

      <span>{{ appStore.statusViewerVersion }}</span>
    </div>
  </div>
</template>

<script setup>
import { useAppStore } from "../stores/app.js";
import { useWorkspaceStore } from "../stores/workspace.js";

defineEmits(["goto-bookmark"]);

const appStore = useAppStore();
const workspaceStore = useWorkspaceStore();
</script>
