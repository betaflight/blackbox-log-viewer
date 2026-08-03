<template>
  <div id="stepResponse" class="stepResponse">
    <canvas width="0" height="0" id="stepResponseCanvas"></canvas>

    <span id="stepResponseToolbar">
      <label class="stepResponseAxis stepResponseAxis-roll" title="Show/hide roll">
        Roll
        <USwitch v-model="rollEnabled" size="xs" />
      </label>
      <label class="stepResponseAxis stepResponseAxis-pitch" title="Show/hide pitch">
        Pitch
        <USwitch v-model="pitchEnabled" size="xs" />
      </label>
      <label class="stepResponseAxis stepResponseAxis-yaw" title="Show/hide yaw">
        Yaw
        <USwitch v-model="yawEnabled" size="xs" />
      </label>
    </span>

    <div
      id="stepResponseResize"
      class="view-stepresponse-fullscreen"
      :class="{ 'non-shift': !graphStore.stepResponseShiftActive }"
      :style="resizeButtonStyle"
      title="Zoom Step Response Window"
      @click="toggleFullscreen"
    >
      <UButton
        variant="outline"
        color="neutral"
        size="xs"
        class="stepresponse-icon-resize-full"
        icon="i-lucide-maximize-2"
        :ui="{ base: 'bg-neutral-800 text-white border-neutral-600' }"
      />
      <UButton
        variant="outline"
        color="neutral"
        size="xs"
        class="stepresponse-icon-resize-small"
        icon="i-lucide-minimize-2"
        :ui="{ base: 'bg-neutral-800 text-white border-neutral-600' }"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useGraphStore } from "../stores/graph.js";
import { useSettingsStore } from "../stores/settings.js";

const graphStore = useGraphStore();
const { userSettings } = useSettingsStore();

const rollEnabled = ref(userSettings.stepResponseAxes?.roll ?? true);
const pitchEnabled = ref(userSettings.stepResponseAxes?.pitch ?? true);
const yawEnabled = ref(userSettings.stepResponseAxes?.yaw ?? true);

watch(rollEnabled, (val) => graphStore.setStepResponseAxisEnabled("roll", val));
watch(pitchEnabled, (val) => graphStore.setStepResponseAxisEnabled("pitch", val));
watch(yawEnabled, (val) => graphStore.setStepResponseAxisEnabled("yaw", val));

const layout = computed(() => graphStore.stepResponseLayout);

const resizeButtonStyle = computed(() => ({
  left: `${layout.value.width - 28}px`,
}));

function toggleFullscreen() {
  graphStore.toggleStepResponseFullscreen();
}
</script>
