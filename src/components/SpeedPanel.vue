<template>
  <li class="log-playback-rate-panel">
    <h4>Speed</h4>
    <div class="flex items-center gap-1">
      <USlider
        v-model="rate"
        :min="10"
        :max="300"
        :step="5"
        class="w-20"
        title="Playback speed"
        @dblclick="$emit('rate-change', 100)"
      />
      <UBadge color="primary" variant="solid" size="sm" class="font-mono min-w-[42px] justify-center">
        {{ playbackStore.playbackRate }}%
      </UBadge>
    </div>
  </li>
</template>

<script setup>
import { computed } from "vue";
import { usePlaybackStore } from "../stores/playback.js";

const emit = defineEmits(["rate-change"]);

const playbackStore = usePlaybackStore();

const rate = computed({
  get: () => playbackStore.playbackRate,
  set: (val) => emit("rate-change", val),
});
</script>
