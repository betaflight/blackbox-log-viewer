<template>
  <div class="flex items-center gap-2 px-4 py-1">
    <!-- Playback buttons -->
    <div class="flex items-center gap-1">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-skip-back"
        size="xs"
        @click="$emit('jump-start')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-step-back"
        size="xs"
        @click="$emit('step-back')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        :icon="playbackStore.isPlaying() ? 'i-lucide-pause' : 'i-lucide-play'"
        size="sm"
        @click="playbackStore.togglePlayPause()"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-step-forward"
        size="xs"
        @click="$emit('step-forward')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-skip-forward"
        size="xs"
        @click="$emit('jump-end')"
      />
    </div>

    <!-- Time display -->
    <span class="text-sm font-mono text-neutral-400 min-w-24 text-center">
      {{ formattedTime }}
    </span>

    <!-- Speed -->
    <div class="flex items-center gap-1">
      <span class="text-xs text-neutral-500">Speed</span>
      <span class="text-sm font-mono min-w-12 text-center">
        {{ playbackStore.playbackRate }}%
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { usePlaybackStore } from "../stores/playback.js";
import { useLogStore } from "../stores/log.js";

defineEmits(["jump-start", "jump-end", "step-back", "step-forward"]);

const playbackStore = usePlaybackStore();
const logStore = useLogStore();

const formattedTime = computed(() => {
  const timeUs = logStore.currentBlackboxTime;
  const totalMs = Math.abs(timeUs / 1000);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const ms = Math.floor(totalMs % 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
});
</script>
