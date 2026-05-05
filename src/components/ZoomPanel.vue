<template>
  <li class="log-chart-zoom-panel">
    <h4>Zoom</h4>
    <div class="flex items-center gap-1">
      <USlider
        v-model="zoom"
        :min="1"
        :max="1000"
        :step="1"
        class="w-20"
        title="Graph zoom level"
        @dblclick="$emit('zoom-change', 100)"
      />
      <UBadge color="primary" variant="solid" size="sm" class="font-mono min-w-[42px] justify-center">
        {{ graphStore.graphZoom }}%
      </UBadge>
    </div>
  </li>
</template>

<script setup>
import { computed } from "vue";
import { useGraphStore } from "../stores/graph.js";

const emit = defineEmits(["zoom-change"]);

const graphStore = useGraphStore();

const zoom = computed({
  get: () => graphStore.graphZoom,
  set: (val) => emit("zoom-change", val),
});
</script>
