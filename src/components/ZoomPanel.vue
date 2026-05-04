<template>
  <li class="log-chart-zoom-panel">
    <h4>Zoom</h4>
    <div class="flex items-center gap-1">
      <input
        type="range"
        class="controls-slider"
        :min="1"
        :max="1000"
        :step="1"
        :value="graphStore.graphZoom"
        title="Graph zoom level"
        @input="$emit('zoom-change', Number($event.target.value))"
        @dblclick="$emit('zoom-change', 100)"
      />
      <span class="controls-value">
        {{ graphStore.graphZoom }}%
      </span>
    </div>
  </li>
</template>

<script setup>
import { useGraphStore } from "../stores/graph.js";

defineEmits(["zoom-change"]);

const graphStore = useGraphStore();
</script>
