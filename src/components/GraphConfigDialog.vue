<template>
  <UModal v-model:open="open" :ui="{ width: 'max-w-5xl' }">
    <template #header>
      <h4 class="font-semibold">Configure graphs</h4>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-4 max-h-[70vh] overflow-y-auto">
        <!-- Top actions -->
        <div class="flex items-center justify-between">
          <div class="relative" ref="dropdownRef">
            <UButton
              color="primary"
              icon="i-lucide-plus"
              label="Add graph"
              @click="dropdownOpen = !dropdownOpen"
            />
            <div
              v-if="dropdownOpen"
              class="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-lg shadow-lg max-h-64 overflow-y-auto min-w-48"
            >
              <button
                v-for="(eg, i) in exampleGraphs"
                :key="i"
                class="block w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                :class="{ 'border-b dark:border-neutral-700': eg.dividerAfter }"
                @click="addExampleGraph(eg); dropdownOpen = false"
              >
                {{ eg.label }}
              </button>
            </div>
          </div>
          <UButton
            v-if="localGraphs.length > 0"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            label="Remove all"
            @click="localGraphs = []; emitUpdate()"
          />
        </div>

        <!-- Graph list -->
        <ul class="flex flex-col gap-3">
          <li
            v-for="(graph, gIdx) in localGraphs"
            :key="gIdx"
            class="border rounded-lg p-3 dark:border-neutral-700"
          >
            <!-- Graph header -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <h5 class="font-semibold text-sm">Graph {{ gIdx + 1 }}</h5>
                <input
                  v-model="graph.label"
                  type="text"
                  placeholder="Axis label"
                  class="px-2 py-1 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800 w-48"
                  @change="emitUpdate()"
                />
                <select
                  v-model.number="graph.height"
                  class="px-2 py-1 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800 w-16 cursor-pointer"
                  @change="emitUpdate()"
                >
                  <option v-for="h in 5" :key="h" :value="h">{{ h }}</option>
                </select>
              </div>
              <UButton
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                size="xs"
                @click="localGraphs.splice(gIdx, 1); emitUpdate()"
              />
            </div>

            <!-- Field table -->
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b dark:border-neutral-700 text-xs text-neutral-500">
                  <th class="text-left py-1 w-48">Name</th>
                  <th class="text-center py-1 w-16">Smooth</th>
                  <th class="text-center py-1 w-16">Expo</th>
                  <th class="text-center py-1 w-14">Line</th>
                  <th class="text-center py-1 w-20">Color</th>
                  <th class="text-center py-1 w-20">Min</th>
                  <th class="text-center py-1 w-20">Max</th>
                  <th class="w-8" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(field, fIdx) in graph.fields"
                  :key="fIdx"
                  class="border-b dark:border-neutral-800"
                >
                  <td class="py-1 pr-2">
                    <select
                      v-model="field.name"
                      class="w-full px-1 py-0.5 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800 cursor-pointer"
                      @change="onFieldChange(graph, field); emitUpdate()"
                    >
                      <option value="">(choose a field)</option>
                      <option v-for="fn in offeredFields" :key="fn" :value="fn">
                        {{ friendlyName(fn) }}
                      </option>
                    </select>
                  </td>
                  <td class="py-1 text-center">
                    <input
                      :value="formatSmoothing(field)"
                      class="w-14 px-1 py-0.5 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800 text-center"
                      @change="parseSmoothing(field, $event.target.value); emitUpdate()"
                    />
                  </td>
                  <td class="py-1 text-center">
                    <input
                      :value="formatExpo(field)"
                      class="w-14 px-1 py-0.5 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800 text-center"
                      @change="parseExpo(field, $event.target.value); emitUpdate()"
                    />
                  </td>
                  <td class="py-1 text-center">
                    <input
                      v-model.number="field.lineWidth"
                      type="number"
                      min="1"
                      max="5"
                      class="w-12 px-1 py-0.5 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800 text-center"
                      @change="emitUpdate()"
                    />
                  </td>
                  <td class="py-1 text-center">
                    <select
                      v-model="field.color"
                      class="w-18 px-1 py-0.5 text-sm border rounded cursor-pointer"
                      :style="{ backgroundColor: field.color, color: field.color }"
                      @change="emitUpdate()"
                    >
                      <option
                        v-for="c in palette"
                        :key="c.color"
                        :value="c.color"
                        :style="{ color: c.color }"
                      >
                        {{ c.name }}
                      </option>
                    </select>
                  </td>
                  <td class="py-1 text-center">
                    <input
                      :value="field.curve?.MinMax?.min?.toFixed(1) ?? ''"
                      class="w-18 px-1 py-0.5 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800 text-center"
                      @change="setMin(field, $event.target.value); emitUpdate()"
                      @dblclick="resetMin(field); emitUpdate()"
                    />
                  </td>
                  <td class="py-1 text-center">
                    <input
                      :value="field.curve?.MinMax?.max?.toFixed(1) ?? ''"
                      class="w-18 px-1 py-0.5 text-sm border rounded dark:border-neutral-600 dark:bg-neutral-800 text-center"
                      @change="setMax(field, $event.target.value); emitUpdate()"
                      @dblclick="resetMax(field); emitUpdate()"
                    />
                  </td>
                  <td class="py-1 text-center">
                    <button
                      class="text-neutral-400 hover:text-red-500 cursor-pointer"
                      @click="removeField(graph, fIdx)"
                    >
                      <span class="i-lucide-x w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-plus"
              label="Add field"
              size="xs"
              class="mt-1"
              @click="addField(graph)"
            />
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="outline" color="neutral" label="Cancel" @click="onCancel" />
        <UButton color="primary" label="Apply changes" @click="onSave" />
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, watch } from "vue";
import { GraphConfig } from "../graph_config.js";
import { FlightLogFieldPresenter } from "../flightlog_fields_presenter.js";

const open = defineModel("open", { type: Boolean, default: false });

const props = defineProps({
  flightLog: { type: Object, default: null },
  graphConfig: { type: Object, default: null },
});

const emit = defineEmits(["save", "update"]);

const palette = GraphConfig.PALETTE;
const localGraphs = ref([]);
const prevConfig = ref(null);
const offeredFields = ref([]);
const exampleGraphs = ref([]);
const dropdownOpen = ref(false);
const dropdownRef = ref(null);

// Build the offered field names list
function buildOfferedFields() {
  if (!props.flightLog) return;

  const BLACKLISTED = { time: true, loopIteration: true, "setpoint[0]": true, "setpoint[1]": true, "setpoint[2]": true, "setpoint[3]": true };
  const fieldNames = props.flightLog.getMainFieldNames();
  const result = [];
  const seen = {};
  let lastRoot = null;

  for (const name of fieldNames) {
    if (BLACKLISTED[name]) continue;
    const m = name.match(/^(.+)\[[0-9]+\]$/);
    if (m) {
      if (m[1] !== lastRoot) {
        lastRoot = m[1];
        const allName = `${lastRoot}[all]`;
        result.push(allName);
        seen[allName] = true;
      }
    } else {
      lastRoot = null;
    }
    result.push(name);
    seen[name] = true;
  }

  // Include any fields from current config that aren't in this log
  if (props.graphConfig) {
    const graphs = props.graphConfig.getGraphs();
    for (const g of graphs) {
      for (const f of g.fields) {
        if (!seen[f.name]) {
          result.push(f.name);
          seen[f.name] = true;
        }
      }
    }
  }

  offeredFields.value = result;
}

function buildExampleGraphs() {
  if (!props.flightLog) return;
  const examples = GraphConfig.getExampleGraphConfigs(props.flightLog);
  examples.unshift({ label: "Custom graph", fields: [{ name: "" }], dividerAfter: true });
  exampleGraphs.value = examples;
}

function cloneGraphs(graphs) {
  return JSON.parse(JSON.stringify(graphs));
}

// Convert internal graph config to the format expected by legacy code
function convertToConfig() {
  return localGraphs.value.map((g) => ({
    label: g.label || "",
    height: g.height || 1,
    fields: g.fields
      .filter((f) => f.name)
      .map((f) => ({
        name: f.name,
        smoothing: f.smoothing,
        curve: {
          power: f.curve?.power ?? 1,
          MinMax: {
            min: f.curve?.MinMax?.min ?? -500,
            max: f.curve?.MinMax?.max ?? 500,
          },
        },
        default: {
          smoothing: f.smoothing,
          power: f.curve?.power ?? 1,
          MinMax: {
            min: f.curve?.MinMax?.min ?? -500,
            max: f.curve?.MinMax?.max ?? 500,
          },
        },
        color: f.color,
        lineWidth: f.lineWidth || 1,
      })),
  }));
}

function friendlyName(fieldName) {
  const debugMode = props.flightLog?.getSysConfig()?.debug_mode;
  return FlightLogFieldPresenter.fieldNameToFriendly(fieldName, debugMode);
}

function getDefaults(fieldName) {
  if (!props.flightLog) return { smoothing: 0, power: 1, MinMax: { min: -500, max: 500 } };
  const smoothing = GraphConfig.getDefaultSmoothingForField(props.flightLog, fieldName);
  const curve = GraphConfig.getDefaultCurveForField(props.flightLog, fieldName);
  return { smoothing, ...curve };
}

function formatSmoothing(field) {
  return `${((field.smoothing ?? 0) / 100).toFixed(0)}%`;
}

function parseSmoothing(field, val) {
  field.smoothing = parseInt(val) * 100;
}

function formatExpo(field) {
  return `${((field.curve?.power ?? 1) * 100).toFixed(0)}%`;
}

function parseExpo(field, val) {
  if (!field.curve) field.curve = {};
  field.curve.power = parseInt(val) / 100;
}

function setMin(field, val) {
  if (!field.curve) field.curve = {};
  if (!field.curve.MinMax) field.curve.MinMax = {};
  field.curve.MinMax.min = parseFloat(val);
}

function setMax(field, val) {
  if (!field.curve) field.curve = {};
  if (!field.curve.MinMax) field.curve.MinMax = {};
  field.curve.MinMax.max = parseFloat(val);
}

function resetMin(field) {
  const defaults = getDefaults(field.name);
  setMin(field, defaults.MinMax.min);
}

function resetMax(field) {
  const defaults = getDefaults(field.name);
  setMax(field, defaults.MinMax.max);
}

function onFieldChange(graph, field) {
  if (!field.name || !props.flightLog || !props.graphConfig) return;

  // Check if this is a group field that expands
  const expanded = props.graphConfig.extendFields(props.flightLog, { name: field.name });
  if (expanded.length > 1) {
    // Replace this field with the expanded set
    const idx = graph.fields.indexOf(field);
    const colorStart = idx;
    const newFields = expanded.map((ef, i) => {
      const c = palette[(colorStart + i) % palette.length].color;
      return makeField(ef.name, ef, c);
    });
    graph.fields.splice(idx, 1, ...newFields);
  } else {
    // Apply defaults for the selected field
    const defaults = getDefaults(field.name);
    field.smoothing = defaults.smoothing;
    field.curve = { power: defaults.power, MinMax: { ...defaults.MinMax } };
  }
}

function makeField(name, existing, color) {
  const defaults = getDefaults(name);
  return {
    name,
    smoothing: existing?.smoothing ?? defaults.smoothing,
    curve: {
      power: existing?.curve?.power ?? defaults.power,
      MinMax: existing?.curve?.MinMax ? { ...existing.curve.MinMax } : { ...defaults.MinMax },
    },
    color: color || existing?.color || palette[0].color,
    lineWidth: existing?.lineWidth ?? 1,
  };
}

function addField(graph) {
  const colorIdx = graph.fields.length;
  const color = palette[colorIdx % palette.length].color;
  graph.fields.push(makeField("", {}, color));
}

function removeField(graph, fIdx) {
  graph.fields.splice(fIdx, 1);
  if (graph.fields.length === 0) {
    const gIdx = localGraphs.value.indexOf(graph);
    if (gIdx !== -1) localGraphs.value.splice(gIdx, 1);
  }
  emitUpdate();
}

function addExampleGraph(example) {
  const colorBase = 0;
  const fields = [];
  for (const f of example.fields) {
    if (!props.flightLog || !props.graphConfig) {
      fields.push(makeField(f.name, f, palette[fields.length % palette.length].color));
      continue;
    }
    const expanded = props.graphConfig.extendFields(props.flightLog, f);
    for (const ef of expanded) {
      const c = ef.color && ef.color !== -1 ? ef.color : palette[(colorBase + fields.length) % palette.length].color;
      fields.push(makeField(ef.name, ef, c));
    }
  }
  localGraphs.value.push({
    label: example.label || "",
    height: example.height || 1,
    fields,
  });
  if (example.label !== "Custom graph") emitUpdate();
}

function emitUpdate() {
  emit("update", convertToConfig());
}

function onSave() {
  emit("save", convertToConfig());
  open.value = false;
}

function onCancel() {
  // Restore previous config
  if (prevConfig.value) {
    emit("update", prevConfig.value);
  }
  open.value = false;
}

// Initialize when dialog opens
watch(open, (val) => {
  if (!val) {
    dropdownOpen.value = false;
    return;
  }
  buildOfferedFields();
  buildExampleGraphs();

  // Clone current graphs into local state
  if (props.graphConfig) {
    const graphs = props.graphConfig.getGraphs();
    const cloned = [];
    for (const g of graphs) {
      const fields = [];
      for (const f of g.fields) {
        if (!props.flightLog) continue;
        const expanded = props.graphConfig.extendFields(props.flightLog, f);
        for (const ef of expanded) {
          const c = ef.color && ef.color !== -1 ? ef.color : palette[fields.length % palette.length].color;
          fields.push(makeField(ef.name, ef, c));
        }
      }
      cloned.push({ label: g.label || "", height: g.height || 1, fields });
    }
    localGraphs.value = cloned;
    prevConfig.value = convertToConfig();
  }
});

// Close dropdown when clicking outside
function onClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    dropdownOpen.value = false;
  }
}
if (typeof document !== "undefined") {
  document.addEventListener("click", onClickOutside, true);
}
</script>
