<template>
  <div ref="container" class="relative w-full h-full">
    <video ref="videoEl" class="absolute inset-0" />
    <canvas ref="graphCanvas" class="w-full h-full" />
    <canvas ref="craftCanvas" class="absolute" />
    <canvas ref="stickCanvas" class="absolute" />
    <div ref="analyserContainer" class="absolute analyser">
      <canvas ref="analyserCanvas" />
    </div>
    <div ref="mapContainer" class="absolute map-container" />
  </div>
</template>

<script setup>
import { ref } from "vue";

const container = ref(null);
const graphCanvas = ref(null);
const craftCanvas = ref(null);
const stickCanvas = ref(null);
const analyserCanvas = ref(null);
const analyserContainer = ref(null);
const mapContainer = ref(null);
const videoEl = ref(null);

// Expose canvas elements for legacy code to access during migration
defineExpose({
  graphCanvas,
  craftCanvas,
  stickCanvas,
  analyserCanvas,
  analyserContainer,
  mapContainer,
  videoEl,
});
</script>
