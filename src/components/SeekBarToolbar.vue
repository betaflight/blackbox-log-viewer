<template>
  <span id="seekbarToolbar" class="non-shift">
    <div id="seekbarType" class="seekBar-selection" title="Value to plot">
      <USelect
        v-model="seekbarType"
        :items="seekbarOptions"
        size="xs"
        class="w-full"
      />
    </div>
  </span>
</template>

<script setup>
import { ref, watch } from "vue";
import { useAppStore } from "../stores/app.js";
import { useGraphStore } from "../stores/graph.js";

const appStore = useAppStore();
const graphStore = useGraphStore();

const seekbarOptions = [
  { label: "Average motor throttle", value: "avgThrottle" },
  { label: "Maximum stick input", value: "maxRC" },
  { label: "Maximum motor differential", value: "maxMotorDiff" },
];

const seekbarType = ref(graphStore.seekBarMode || "avgThrottle");

watch(seekbarType, (val) => {
  appStore.controller?.setSeekBarMode?.(val);
});
</script>
