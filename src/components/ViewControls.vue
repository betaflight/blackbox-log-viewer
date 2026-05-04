<template>
  <div class="flex items-center gap-1">
    <UButton
      variant="ghost"
      :color="graphStore.hasTable ? 'primary' : 'neutral'"
      icon="i-lucide-table"
      size="xs"
      @click="graphStore.hasTable = !graphStore.hasTable"
    />
    <UButton
      variant="ghost"
      :color="graphStore.hasAnalyser ? 'primary' : 'neutral'"
      icon="i-lucide-bar-chart-3"
      size="xs"
      @click="graphStore.hasAnalyser = !graphStore.hasAnalyser"
    />
    <UButton
      variant="ghost"
      :color="graphStore.hasMap ? 'primary' : 'neutral'"
      icon="i-lucide-map"
      size="xs"
      @click="graphStore.hasMap = !graphStore.hasMap"
    />
  </div>
</template>

<script setup>
import { useGraphStore } from "../stores/graph.js";

const graphStore = useGraphStore();
</script>
