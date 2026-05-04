<template>
  <li class="log-sync-panel">
    <h4>Log sync</h4>
    <div class="flex items-center gap-1">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-step-back"
        size="xs"
        title="Move log earlier"
        @click="$emit('sync-back')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-align-start-vertical"
        size="xs"
        title="Start log here"
        @click="$emit('sync-here')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-step-forward"
        size="xs"
        title="Move log later"
        @click="$emit('sync-forward')"
      />
      <input
        type="text"
        class="w-16 px-1 py-0.5 text-sm bg-neutral-800 border border-neutral-600 rounded text-white font-mono"
        :value="appStore.videoOffsetDisplay"
        title="Enter a time offset"
        @change="$emit('offset-change', $event.target.value)"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-align-center-vertical"
        size="xs"
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
