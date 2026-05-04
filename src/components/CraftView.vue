<template>
  <canvas ref="canvas" class="absolute" />
</template>

<script setup>
import { ref, defineExpose } from "vue";

const canvas = ref(null);

// Expose for legacy Craft2D/Craft3D renderer
defineExpose({
  canvas,
});
</script>
