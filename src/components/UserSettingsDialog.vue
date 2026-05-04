<template>
  <UModal v-model:open="open" :ui="{ width: 'max-w-4xl' }">
    <template #header>
      <h4 class="font-semibold">Advanced User Settings</h4>
    </template>

    <template #body>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 max-h-[70vh] overflow-y-auto">
        <!-- Left column -->
        <div class="flex flex-col gap-4">
          <!-- Mixer Settings -->
          <SettingsSection title="Mixer Settings">
            <ToggleRow v-model="local.customMix" label="Custom" description="Select custom craft display." :as-bool="true" />
            <div v-if="local.customMix" class="flex flex-col gap-2 mt-2">
              <div class="flex items-center gap-4">
                <USelect
                  v-model="local.mixerConfiguration"
                  :items="mixerOptions"
                  class="flex-1"
                />
                <img
                  :src="`./images/motor_order/${mixerImageName}.svg`"
                  class="w-16 h-16 object-contain"
                  :alt="mixerName"
                />
              </div>
              <p class="text-xs text-neutral-500">
                Custom mixer settings only affect the craft icon displayed over the log.
              </p>
            </div>
          </SettingsSection>

          <!-- Stick Settings -->
          <SettingsSection title="Stick Settings">
            <ToggleRow v-model="local.stickUnits" label="Units" description="Display actual units on stick display." />
            <ToggleRow v-model="local.stickTrails" label="Stick Trails" description="Show stick trails." />
            <ToggleRow v-model="local.stickInvertYaw" label="Invert Yaw" description="Invert yaw in stick display." />
            <div class="flex items-center gap-4 mt-2">
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium">Mode</span>
                <div class="flex gap-3">
                  <label v-for="m in 4" :key="m" class="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" :value="m" v-model.number="local.stickMode" class="accent-primary" />
                    Mode {{ m }}
                  </label>
                </div>
              </div>
              <img
                :src="`./images/stick_modes/Mode_${local.stickMode}.png`"
                class="w-20 h-16 object-contain"
                alt="Stick mode preview"
              />
            </div>
            <PositionInputs v-model:top="local.sticks.top" v-model:left="local.sticks.left" v-model:size="local.sticks.size" />
          </SettingsSection>

          <!-- Legend Settings -->
          <SettingsSection title="Legend Settings">
            <ToggleRow v-model="local.legendUnits" label="Units" description="Display actual units on legend." />
          </SettingsSection>

          <!-- Measurement System -->
          <SettingsSection title="Measurement System">
            <div class="flex flex-col gap-2">
              <span class="text-sm font-medium">Speed Units</span>
              <div class="flex gap-3">
                <label v-for="opt in speedOptions" :key="opt.value" class="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" :value="opt.value" v-model.number="local.speedUnits" class="accent-primary" />
                  {{ opt.label }}
                </label>
              </div>
            </div>
            <div class="flex flex-col gap-2 mt-2">
              <span class="text-sm font-medium">Altitude Units</span>
              <div class="flex gap-3">
                <label v-for="opt in altitudeOptions" :key="opt.value" class="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" :value="opt.value" v-model.number="local.altitudeUnits" class="accent-primary" />
                  {{ opt.label }}
                </label>
              </div>
            </div>
          </SettingsSection>
        </div>

        <!-- Right column -->
        <div class="flex flex-col gap-4">
          <!-- Craft Settings -->
          <SettingsSection title="Craft Settings">
            <PositionInputs v-model:top="local.craft.top" v-model:left="local.craft.left" v-model:size="local.craft.size" />
          </SettingsSection>

          <!-- Analyser Settings -->
          <SettingsSection title="Analyser Settings">
            <ToggleRow v-model="local.analyserHanning" label="Hanning" description="Use Hanning window for analyser." />
            <PositionInputs v-model:top="local.analyser.top" v-model:left="local.analyser.left" v-model:size="local.analyser.size" label="Position" />
            <PositionInputs v-model:top="local.analyser_legend.top" v-model:left="local.analyser_legend.left" v-model:size="local.analyser_legend.width" label="Legend" size-label="Width" />
          </SettingsSection>

          <!-- Map Settings -->
          <SettingsSection title="Map Settings">
            <ToggleRow v-model="local.mapTrailAltitudeColored" label="ACT" description="Use altitude colored trail (slower)." />
            <PositionInputs v-model:top="local.map.top" v-model:left="local.map.left" v-model:size="local.map.size" />
          </SettingsSection>

          <!-- Watermark Settings -->
          <SettingsSection title="Watermark Settings">
            <ToggleRow v-model="local.drawWatermark" label="Watermark" description="Show the watermark." />
            <div v-if="local.drawWatermark" class="flex flex-col gap-2 mt-2">
              <div class="flex items-center gap-3">
                <label class="text-sm">Logo</label>
                <input type="file" accept="image/*" class="text-sm" @change="onLogoChange" />
              </div>
              <img
                v-if="local.watermark.logo"
                :src="local.watermark.logo"
                class="w-24 h-16 object-contain border rounded dark:border-neutral-700"
                alt="Watermark logo"
              />
              <PositionInputs v-model:top="local.watermark.top" v-model:left="local.watermark.left" v-model:size="local.watermark.size" />
              <PercentInput v-model="local.watermark.transparency" label="Transparency" />
            </div>
          </SettingsSection>

          <!-- Lap Timer Settings -->
          <SettingsSection title="Lap Timer Settings">
            <ToggleRow v-model="local.drawLapTimer" label="Lap Timer" description="Show the lap timer." />
            <div v-if="local.drawLapTimer" class="flex flex-col gap-2 mt-2">
              <PositionInputs v-model:top="local.laptimer.top" v-model:left="local.laptimer.left" />
              <PercentInput v-model="local.laptimer.transparency" label="Transparency" />
              <p class="text-xs text-neutral-500">
                Set a "start time" bookmark at the beginning of the log/video plus additional bookmarks to mark the start of each lap.
              </p>
            </div>
          </SettingsSection>

          <!-- Graph Style Settings -->
          <SettingsSection title="Graph Style Settings">
            <ToggleRow v-model="local.drawGradient" label="Gradient" description="Show the gradient background." />
            <ToggleRow v-model="local.drawVerticalBar" label="TimeBar" description="Show the vertical timebar." />
          </SettingsSection>

          <!-- Dark Mode -->
          <SettingsSection title="Dark Mode">
            <div class="flex flex-col gap-1">
              <label v-for="opt in darkModeOptions" :key="opt.value" class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" :value="opt.value" v-model.number="local.darkMode" class="accent-primary" />
                {{ opt.label }}
              </label>
            </div>
          </SettingsSection>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="outline" color="neutral" label="Cancel" @click="open = false" />
        <UButton color="primary" label="Save" @click="onSave" />
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { h, ref, watch, computed } from "vue";
import { mixerList } from "../user_settings_data.js";

const open = defineModel("open", { type: Boolean, default: false });

const props = defineProps({
  settings: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["save"]);

// Deep-clone settings into local state when dialog opens or settings change
function cloneSettings(src) {
  return JSON.parse(JSON.stringify(src));
}

const local = ref(cloneSettings(props.settings));

watch(
  () => props.settings,
  (val) => { local.value = cloneSettings(val); },
);

// Re-clone when dialog opens to pick up any external changes
watch(open, (val) => {
  if (val) local.value = cloneSettings(props.settings);
});

// Mixer helpers
const mixerOptions = mixerList.map((m, i) => ({ label: m.name, value: i + 1 }));

const mixerImageName = computed(() => {
  const idx = (local.value.mixerConfiguration || 3) - 1;
  return mixerList[idx]?.image ?? "custom";
});

const mixerName = computed(() => {
  const idx = (local.value.mixerConfiguration || 3) - 1;
  return mixerList[idx]?.name ?? "Custom";
});

// Option data
const speedOptions = [
  { label: "m/s", value: 1 },
  { label: "kph", value: 2 },
  { label: "mph", value: 3 },
];

const altitudeOptions = [
  { label: "meters", value: 1 },
  { label: "feet", value: 2 },
];

const darkModeOptions = [
  { label: "Auto (follow system setting)", value: 2 },
  { label: "Off (always light)", value: 1 },
  { label: "On (always dark)", value: 0 },
];

function onLogoChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => { local.value.watermark.logo = ev.target.result; };
  reader.readAsDataURL(file);
}

function onSave() {
  emit("save", cloneSettings(local.value));
  open.value = false;
}

// --- Functional sub-components ---

const SettingsSection = (props, { slots }) =>
  h("div", { class: "border rounded-lg p-3 dark:border-neutral-700" }, [
    h("h5", { class: "font-semibold text-sm mb-2 uppercase tracking-wide text-neutral-500 dark:text-neutral-400" }, props.title),
    h("div", { class: "flex flex-col gap-1" }, slots.default?.()),
  ]);
SettingsSection.props = ["title"];

const ToggleRow = (props, { emit }) => {
  // asBool: treat null/non-null as boolean (for customMix)
  const checked = props.asBool ? !!props.modelValue : props.modelValue;
  return h("div", { class: "flex items-center justify-between py-1" }, [
    h("div", [
      h("span", { class: "text-sm font-medium" }, props.label),
      props.description ? h("p", { class: "text-xs text-neutral-500" }, props.description) : null,
    ]),
    h("input", {
      type: "checkbox",
      checked,
      class: "accent-primary cursor-pointer w-4 h-4",
      onChange: (e) => {
        const val = props.asBool ? (e.target.checked ? {} : null) : e.target.checked;
        emit("update:modelValue", val);
      },
    }),
  ]);
};
ToggleRow.props = ["modelValue", "label", "description", "asBool"];
ToggleRow.emits = ["update:modelValue"];

const PercentInput = (props, { emit }) =>
  h("div", { class: "flex items-center gap-2" }, [
    h("label", { class: "text-sm text-neutral-600 dark:text-neutral-400 w-24" }, props.label),
    h("input", {
      type: "number",
      min: 0,
      max: 100,
      step: 1,
      value: parseInt(props.modelValue) || 0,
      class: "w-16 px-2 py-1 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800",
      onInput: (e) => emit("update:modelValue", `${e.target.value}%`),
    }),
    h("span", { class: "text-xs text-neutral-500" }, "%"),
  ]);
PercentInput.props = ["modelValue", "label"];
PercentInput.emits = ["update:modelValue"];

const PositionInputs = (props, { emit }) => {
  const field = (label, key, val) =>
    h("div", { class: "flex items-center gap-1" }, [
      h("label", { class: "text-xs text-neutral-500" }, label),
      h("input", {
        type: "number",
        min: 0,
        max: 100,
        step: 1,
        value: parseInt(val) || 0,
        class: "w-14 px-1.5 py-0.5 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800",
        onInput: (e) => emit(`update:${key}`, `${e.target.value}%`),
      }),
      h("span", { class: "text-xs text-neutral-500" }, "%"),
    ]);

  const fields = [
    field("Top", "top", props.top),
    field("Left", "left", props.left),
  ];
  if (props.size !== undefined) {
    fields.push(field(props.sizeLabel || "Size", "size", props.size));
  }

  return h("div", { class: "flex items-center gap-3 mt-1" }, [
    h("span", { class: "text-sm text-neutral-600 dark:text-neutral-400 w-16 shrink-0" }, props.label || "Position"),
    ...fields,
  ]);
};
PositionInputs.props = ["top", "left", "size", "label", "sizeLabel"];
PositionInputs.emits = ["update:top", "update:left", "update:size"];
</script>
