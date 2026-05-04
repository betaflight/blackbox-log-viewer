<template>
  <UModal v-model:open="open">
    <template #header>
      <h4 class="font-semibold">Settings</h4>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 p-4">
        <!-- Mixer -->
        <div>
          <h5 class="font-semibold mb-2">Mixer</h5>
          <USelect
            v-model="localSettings.mixerConfiguration"
            :items="mixerOptions"
            placeholder="Select mixer"
          />
        </div>

        <!-- Display -->
        <div>
          <h5 class="font-semibold mb-2">Display</h5>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm">Draw craft</span>
              <USwitch v-model="localSettings.drawCraft" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">Draw sticks</span>
              <USwitch v-model="localSettings.drawSticks" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">Draw PID table</span>
              <USwitch v-model="localSettings.drawPidTable" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">Draw time</span>
              <USwitch v-model="localSettings.drawTime" />
            </div>
          </div>
        </div>

        <!-- Analyser -->
        <div>
          <h5 class="font-semibold mb-2">Analyser</h5>
          <div class="flex items-center justify-between">
            <span class="text-sm">Analyser size</span>
            <USelect
              v-model="localSettings.analyserHPercent"
              :items="analyserSizeOptions"
              class="w-24"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          variant="outline"
          color="neutral"
          label="Cancel"
          @click="open = false"
        />
        <UButton
          color="primary"
          label="Save"
          @click="onSave"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, watch } from "vue";

const open = defineModel("open", { type: Boolean, default: false });

const props = defineProps({
  settings: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["save"]);

const localSettings = ref({ ...props.settings });

watch(
  () => props.settings,
  (val) => {
    localSettings.value = { ...val };
  },
);

const mixerOptions = [
  "Tricopter",
  "Quad +",
  "Quad X",
  "Bicopter",
  "Hex +",
  "Hex X",
  "Octo X",
  "Flying Wing",
].map((name) => ({ label: name, value: name }));

const analyserSizeOptions = [
  { label: "25%", value: 25 },
  { label: "50%", value: 50 },
  { label: "75%", value: 75 },
  { label: "100%", value: 100 },
];

function onSave() {
  emit("save", localSettings.value);
  open.value = false;
}
</script>
