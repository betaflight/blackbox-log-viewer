<template>
  <div
    v-show="graphStore.hasAnalyser"
    ref="container"
    class="absolute analyser"
  >
    <canvas ref="canvas" />

    <!-- Toolbar -->
    <div v-show="graphStore.hasAnalyserFullscreen" class="flex items-center gap-2 p-1">
      <select v-model="spectrumType" class="text-xs bg-neutral-800 text-white rounded px-1">
        <option value="0">Frequency</option>
        <option value="1">Freq. vs Throttle</option>
        <option value="2">Freq. vs RPM</option>
        <option value="3">Power Spectral Density</option>
        <option value="4">PSD vs Throttle</option>
        <option value="5">PSD vs RPM</option>
        <option value="6">Error vs Setpoint</option>
      </select>

      <select v-model="filterType" class="text-xs bg-neutral-800 text-white rounded px-1">
        <option value="0">Show all filters</option>
        <option value="1">Gyro filters only</option>
        <option value="2">D-Term filters only</option>
        <option value="3">Yaw filters only</option>
        <option value="4">Hide all filters</option>
        <option value="5">Auto</option>
      </select>

      <UButton
        variant="ghost"
        color="neutral"
        :icon="graphStore.hasAnalyserFullscreen ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
        size="2xs"
        @click="graphStore.hasAnalyserFullscreen = !graphStore.hasAnalyserFullscreen"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useGraphStore } from "../stores/graph.js";

const graphStore = useGraphStore();
const container = ref(null);
const canvas = ref(null);
const spectrumType = ref("0");
const filterType = ref("0");

// Expose for legacy FlightLogAnalyser
defineExpose({
  container,
  canvas,
});
</script>
