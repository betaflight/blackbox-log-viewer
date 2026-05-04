<template>
  <li class="log-chart-time-panel">
    <h4>Time</h4>
    <div>
      <input
        type="text"
        class="w-20 px-1 py-0.5 text-sm bg-neutral-800 border border-neutral-600 rounded text-white font-mono"
        :value="appStore.graphTimeDisplay"
        title="Enter a time to jump to"
        @change="onTimeChange"
      />
    </div>
  </li>
</template>

<script setup>
import { useAppStore } from "../stores/app.js";

const emit = defineEmits(["time-change"]);
const appStore = useAppStore();

function onTimeChange(e) {
  emit("time-change", e.target.value);
}
</script>
