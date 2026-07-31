<template>
  <span id="seekbarToolbar" class="non-shift">
    <div id="seekbarType" class="seekBar-selection" title="Value to plot">
      <span v-if="isRotorflight">Collective position</span>
      <USelect
        v-else
        v-model="seekbarType"
        :items="seekbarOptions"
        size="xs"
        class="w-full"
      />
    </div>
  </span>
</template>

<script setup>
import { computed } from "vue";
import { useGraphStore } from "../stores/graph.js";
import { useLogStore } from "../stores/log.js";
import { FIRMWARE_TYPE_ROTORFLIGHT } from "../flightlog_fielddefs.js";

const graphStore = useGraphStore();
const logStore = useLogStore();

const isRotorflight = computed(
  () =>
    logStore.flightLog?.getSysConfig?.()?.firmwareType === FIRMWARE_TYPE_ROTORFLIGHT,
);

const seekbarOptions = [
  { label: "Average motor throttle", value: "avgThrottle" },
  { label: "Maximum stick input", value: "maxRC" },
  { label: "Maximum motor differential", value: "maxMotorDiff" },
];

const seekbarType = computed({
  get: () => graphStore.seekBarMode || "avgThrottle",
  set: (val) => graphStore.setSeekBarMode?.(val),
});
</script>
