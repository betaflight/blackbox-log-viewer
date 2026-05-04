<template>
  <div class="w-full" :style="{ height: height + 'px' }">
    <canvas ref="canvas" class="w-full h-full" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineExpose } from "vue";

defineProps({
  height: {
    type: Number,
    default: 50,
  },
});

const canvas = ref(null);

// Expose canvas for legacy SeekBar renderer
defineExpose({
  canvas,
});

onMounted(() => {
  // Canvas ready for SeekBar attachment
});

onBeforeUnmount(() => {
  // Cleanup
});
</script>
