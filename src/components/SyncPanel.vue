<template>
  <li class="log-sync-panel">
    <h4>Log sync</h4>
    <div class="flex items-center gap-1">
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-step-back"
        size="sm"
        title="Move log earlier"
        @click="$emit('sync-back')"
      />
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-align-start-vertical"
        size="sm"
        title="Start log here"
        @click="$emit('sync-here')"
      />
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-step-forward"
        size="sm"
        title="Move log later"
        @click="$emit('sync-forward')"
      />
      <input
        type="text"
        class="controls-input w-16"
        :value="appStore.videoOffsetDisplay"
        title="Enter a time offset"
        @change="$emit('offset-change', $event.target.value)"
      />
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-align-center-vertical"
        size="sm"
        title="Smart Sync (Alt+M)"
        @click="$emit('smart-sync')"
      />
    </div>
  </li>
</template>

<script setup>
import { useAppStore } from "../stores/app.js";

defineEmits(["sync-back", "sync-forward", "sync-here", "smart-sync", "offset-change"]);

const appStore = useAppStore();
</script>
