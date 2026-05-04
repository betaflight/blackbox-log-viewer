<template>
  <li class="log-playback-rate-panel">
    <h4>Speed</h4>
    <div class="flex items-center gap-1">
      <input
        type="range"
        class="controls-slider"
        :min="10"
        :max="300"
        :step="5"
        :value="playbackStore.playbackRate"
        title="Playback speed"
        @input="$emit('rate-change', Number($event.target.value))"
        @dblclick="$emit('rate-change', 100)"
      />
      <span class="controls-value">
        {{ playbackStore.playbackRate }}%
      </span>
    </div>
  </li>
</template>

<script setup>
import { usePlaybackStore } from "../stores/playback.js";

defineEmits(["rate-change"]);

const playbackStore = usePlaybackStore();
</script>
