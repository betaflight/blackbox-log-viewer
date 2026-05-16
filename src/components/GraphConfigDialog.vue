<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-fit' }"  class="overflow-visible">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <h4 class="font-semibold">Configure graphs</h4>
        <div class="flex items-center gap-2">
          <UDropdownMenu :items="addGraphItems" :content="{ class: 'z-[300]' }">
            <UButton
              variant="outline"
              color="neutral"
              icon="i-lucide-plus"
              label="Add graph"
              trailing-icon="i-lucide-chevron-down"
              size="xs"
            />
          </UDropdownMenu>
          <UButton
            v-if="localGraphs.length > 0"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            label="Remove all"
            size="xs"
            @click="
              localGraphs = [];
              emitUpdate();
            "
          />
        </div>
      </div>
      <div id="menu-portal-container"></div>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        <!-- Graph panels -->
        <UiBox
          v-for="(graph, gIdx) in localGraphs"
          :key="gIdx"
          :title="`Graph ${gIdx + 1}${graph.label ? ' — ' + graph.label : ''}`"
        >
          <div class="flex flex-col gap-1">
            <!-- Graph settings row -->
            <div class="flex items-center gap-3 mb-1 text-xs">
              <span class="text-dimmed">Label</span>
              <UInput
                v-model="graph.label"
                placeholder="Axis label"
                size="xs"
                class="w-44"
                @change="emitUpdate()"
              />
              <span class="text-dimmed">Height</span>
              <USelect
                v-model.number="graph.height"
                :items="heightOptions"
                :ui="{ content: 'z-[300]' }"
                size="xs"
                class="w-16"
                @change="emitUpdate()"
              />
              <div class="flex-1" />
              <UButton
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                size="xs"
                @click="
                  localGraphs.splice(gIdx, 1);
                  emitUpdate();
                "
              />
            </div>

            <!-- Field grid (PID table style) -->
            <div
              class="grid grid-cols-[11rem_auto_auto_auto_2rem_auto_auto_2rem] gap-x-3 gap-y-1 items-center min-w-0"
            >
              <!-- Header -->
              <div />
              <div class="text-xs text-center text-dimmed">Smooth</div>
              <div class="text-xs text-center text-dimmed">Expo</div>
              <div class="text-xs text-center text-dimmed">Line</div>
              <div class="text-xs text-center text-dimmed">Color</div>
              <div class="text-xs text-center text-dimmed">Min</div>
              <div class="text-xs text-center text-dimmed">Max</div>
              <div />

              <!-- Field rows -->
              <template v-for="(field, fIdx) in graph.fields" :key="fIdx">
                <USelectMenu
                  v-model="field.name"
                  :items="fieldItems"
                  value-key="value"
                  size="xs"
                  :ui="{ content: 'z-[300] max-h-72' }"
                  :search-input="{ placeholder: 'Search fields...' }"
                  @update:model-value="
                    onFieldChange(graph, field);
                    emitUpdate();
                  "
                >
                  <template #default>
                    <span v-if="field.name" class="truncate">{{
                      friendlyName(field.name)
                    }}</span>
                    <span v-else class="opacity-50 truncate"
                      >Choose a field</span
                    >
                  </template>
                </USelectMenu>
                <UInputNumber
                  :model-value="(field.smoothing ?? 0) / 100"
                  :step="1"
                  :min="0"
                  :max="100"
                  :format-options="noGrouping"
                  size="xs"
                  orientation="vertical"
                  :ui="{ root: 'w-16' }"
                  @update:model-value="
                    field.smoothing = $event * 100;
                    emitUpdate();
                  "
                />
                <UInputNumber
                  :model-value="Math.round((field.curve?.power ?? 1) * 100)"
                  :step="10"
                  :min="0"
                  :max="500"
                  :format-options="noGrouping"
                  size="xs"
                  orientation="vertical"
                  :ui="{ root: 'w-16' }"
                  @update:model-value="
                    if (!field.curve) field.curve = {};
                    field.curve.power = $event / 100;
                    emitUpdate();
                  "
                />
                <UInputNumber
                  v-model="field.lineWidth"
                  :step="1"
                  :min="1"
                  :max="5"
                  :format-options="noGrouping"
                  size="xs"
                  orientation="vertical"
                  :ui="{ root: 'w-12' }"
                  @update:model-value="emitUpdate()"
                />
                <div class="flex justify-center">
                  <span
                    class="inline-block w-6 h-6 rounded-sm cursor-pointer border border-neutral-200 dark:border-neutral-700"
                    :style="{ backgroundColor: field.color }"
                    :title="
                      palette.find((c) => c.color === field.color)?.name ||
                      'Color'
                    "
                    @click="cycleColor(field)"
                  />
                </div>
                <UContextMenu :items="menuItems" :portal="false" :ui="{content: 'z-[9999] relative'}">
                  <UInputNumber
                    :model-value="field.curve?.MinMax?.min ?? -500"
                    :step="10"
                    :format-options="noGrouping"
                    size="xs"
                    orientation="vertical"
                    :ui="{ root: 'w-20' }"
                    @update:model-value="
                      setMin(field, $event);
                      emitUpdate();
                    "
                    @dblclick="
                      resetMin(field);
                      emitUpdate();
                    "
                    @contextmenu="(e) => onContextMenu(e, graph, field)"
                  />
                </UContextMenu>
                <UContextMenu :items="menuItems" :portal="false" :ui="{content: 'z-[9999] relative'}">
                  <UInputNumber
                    :model-value="field.curve?.MinMax?.max ?? 500"
                    :step="10"
                    :format-options="noGrouping"
                    size="xs"
                    orientation="vertical"
                    :ui="{ root: 'w-20' }"
                    @update:model-value="
                      setMax(field, $event);
                      emitUpdate();
                    "
                    @dblclick="
                      resetMax(field);
                      emitUpdate();
                    "
                    @contextmenu="(e) => onContextMenu(e, graph, field)"
                  />
                </UContextMenu>
                <UButton
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  size="2xs"
                  @click="removeField(graph, fIdx)"
                />
              </template>
            </div>

            <!-- Add field -->
            <div class="flex justify-end mt-1">
              <UButton
                variant="link"
                color="neutral"
                icon="i-lucide-plus"
                label="Add field"
                size="xs"
                @click="addField(graph)"
              />
            </div>
          </div>
        </UiBox>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          variant="outline"
          color="neutral"
          label="Cancel"
          @click="onCancel"
        />
        <UButton color="primary" label="Apply changes" @click="onSave" />
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import UiBox from "./UiBox.vue";
import { GraphConfig } from "../graph_config.js";
import { FlightLogFieldPresenter } from "../flightlog_fields_presenter.js";

const open = defineModel("open", { type: Boolean, default: false });

const props = defineProps({
  flightLog: { type: Object, default: null },
  graphConfig: { type: Object, default: null },
});

const emit = defineEmits(["save", "update"]);

const palette = GraphConfig.PALETTE;
const noGrouping = { useGrouping: false };
const localGraphs = ref([]);
const prevConfig = ref(null);
const offeredFields = ref([]);
const exampleGraphs = ref([]);

const heightOptions = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
];

// Build USelect items from offered fields
const fieldItems = computed(() =>
  offeredFields.value.map((fn) => ({
    label: friendlyName(fn),
    value: fn,
  })),
);

// Build UDropdownMenu items for "Add graph"
const addGraphItems = computed(() => [
  exampleGraphs.value.map((eg) => ({
    label: eg.label,
    onSelect() {
      addExampleGraph(eg);
    },
  })),
]);

const BLACKLISTED_FIELDS = {
  time: true,
  loopIteration: true,
  "setpoint[0]": true,
  "setpoint[1]": true,
  "setpoint[2]": true,
  "setpoint[3]": true,
};
const ARRAY_FIELD_PATTERN = /^(.+)\[\d+\]$/;

function collectFieldsFromLog(fieldNames, result, seen) {
  let lastRoot = null;
  for (const name of fieldNames) {
    if (BLACKLISTED_FIELDS[name]) {
      continue;
    }
    const m = name.match(ARRAY_FIELD_PATTERN);
    if (m && m[1] !== lastRoot) {
      lastRoot = m[1];
      const allName = `${lastRoot}[all]`;
      result.push(allName);
      seen[allName] = true;
    } else if (!m) {
      lastRoot = null;
    }
    result.push(name);
    seen[name] = true;
  }
}

function collectFieldsFromConfig(graphConfig, result, seen) {
  const graphs = graphConfig.getGraphs();
  for (const g of graphs) {
    for (const f of g.fields) {
      if (!seen[f.name]) {
        result.push(f.name);
        seen[f.name] = true;
      }
    }
  }
}

// Build the offered field names list
function buildOfferedFields() {
  if (!props.flightLog) {
    return;
  }

  const fieldNames = props.flightLog.getMainFieldNames();
  const result = [];
  const seen = {};

  collectFieldsFromLog(fieldNames, result, seen);

  // Include any fields from current config that aren't in this log
  if (props.graphConfig) {
    collectFieldsFromConfig(props.graphConfig, result, seen);
  }

  offeredFields.value = result;
}

function buildExampleGraphs() {
  if (!props.flightLog) {
    return;
  }
  const examples = GraphConfig.getExampleGraphConfigs(props.flightLog);
  examples.unshift({
    label: "Custom graph",
    fields: [{ name: "" }],
    dividerAfter: true,
  });
  exampleGraphs.value = examples;
}

function cloneGraphs(graphs) {
  return structuredClone(graphs);
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
  if (!props.flightLog) {
    return { smoothing: 0, power: 1, MinMax: { min: -500, max: 500 } };
  }
  const smoothing = GraphConfig.getDefaultSmoothingForField(
    props.flightLog,
    fieldName,
  );
  const curve = GraphConfig.getDefaultCurveForField(props.flightLog, fieldName);
  return { smoothing, ...curve };
}

function formatSmoothing(field) {
  return `${((field.smoothing ?? 0) / 100).toFixed(0)}%`;
}

function parseSmoothing(field, val) {
  field.smoothing = Number.parseInt(val) * 100;
}

function formatExpo(field) {
  return `${((field.curve?.power ?? 1) * 100).toFixed(0)}%`;
}

function parseExpo(field, val) {
  if (!field.curve) {
    field.curve = {};
  }
  field.curve.power = Number.parseInt(val) / 100;
}

function ensureCurveMinMax(field) {
  if (!field.curve) {
    field.curve = {};
  }
  if (!field.curve.MinMax) {
    field.curve.MinMax = {};
  }
}

function setMin(field, val) {
  ensureCurveMinMax(field);
  field.curve.MinMax.min = Number.parseFloat(val);
}

function setMax(field, val) {
  ensureCurveMinMax(field);
  field.curve.MinMax.max = Number.parseFloat(val);
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
  if (!field.name || !props.flightLog || !props.graphConfig) {
    return;
  }

  // Check if this is a group field that expands
  const expanded = props.graphConfig.extendFields(props.flightLog, {
    name: field.name,
  });
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
      MinMax: existing?.curve?.MinMax
        ? { ...existing.curve.MinMax }
        : { ...defaults.MinMax },
    },
    color: color || existing?.color || palette[0].color,
    lineWidth: existing?.lineWidth ?? 1,
  };
}

function cycleColor(field) {
  const idx = palette.findIndex((c) => c.color === field.color);
  field.color = palette[(idx + 1) % palette.length].color;
  emitUpdate();
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
    if (gIdx !== -1) {
      localGraphs.value.splice(gIdx, 1);
    }
  }
  emitUpdate();
}

function addExampleGraph(example) {
  const colorBase = 0;
  const fields = [];
  for (const f of example.fields) {
    if (!props.flightLog || !props.graphConfig) {
      fields.push(
        makeField(f.name, f, palette[fields.length % palette.length].color),
      );
      continue;
    }
    const expanded = props.graphConfig.extendFields(props.flightLog, f);
    for (const ef of expanded) {
      const c =
        ef.color && ef.color !== -1
          ? ef.color
          : palette[(colorBase + fields.length) % palette.length].color;
      fields.push(makeField(ef.name, ef, c));
    }
  }
  localGraphs.value.push({
    label: example.label || "",
    height: example.height || 1,
    fields,
  });
  if (example.label !== "Custom graph") {
    emitUpdate();
  }
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

function cloneGraphToLocal(g) {
  const fields = [];
  for (const f of g.fields) {
    if (!props.flightLog) {
      continue;
    }
    const expanded = props.graphConfig.extendFields(props.flightLog, f);
    for (const ef of expanded) {
      const c =
        ef.color && ef.color !== -1
          ? ef.color
          : palette[fields.length % palette.length].color;
      fields.push(makeField(ef.name, ef, c));
    }
  }
  return { label: g.label || "", height: g.height || 1, fields };
}

// Initialize when dialog opens
watch(open, (val) => {
  if (!val) {
    return;
  }
  buildOfferedFields();
  buildExampleGraphs();

  // Clone current graphs into local state
  if (props.graphConfig) {
    localGraphs.value = props.graphConfig.getGraphs().map(cloneGraphToLocal);
    prevConfig.value = convertToConfig();
  }
});

const currentState = {
  graph: null,
  field: null,
};

function onContextMenu(event, graph, field) {
  currentState.graph = graph;
  currentState.field = field;
}

function setMinMaxToDefault() {
  if (currentState.graph?.fields) {
    for (const field of currentState.graph.fields) {
      resetMin(field);
      resetMax(field);
    }
    emitUpdate();
  }
}

function setMinMaxLikeThis() {
  const mm = currentState.field?.curve?.MinMax;
  if (currentState.graph?.fields && mm?.min !== undefined && mm?.max !== undefined) {
    const min = mm.min;
    const max = mm.max;
    for (const field of currentState.graph.fields) {
      setMin(field, min);
      setMax(field, max);
    }
    emitUpdate();
  }
}

function setMinMaxCentered() {
  if (currentState.graph?.fields) {
    for (const field of currentState.graph.fields) {
      const mm = field?.curve?.MinMax;
      if (mm?.min !== undefined && mm?.max !== undefined) {
        let min = mm.min;
        let max = mm.max;
        max = Math.max(Math.abs(min), Math.abs(max));
        min = -max;
        setMin(field, min);
        setMax(field, max);
      }
    }
    emitUpdate();
  }
}

function setMinMaxOneScale() {
  let max = -Number.MAX_VALUE;
  let min;

  if (currentState.graph?.fields) {
    for (const field of currentState.graph.fields) {
      const mm = field?.curve?.MinMax;
      if (mm?.min !== undefined && mm?.max !== undefined) {
        max = Math.max(max, Math.max(Math.abs(mm.min), Math.abs(mm.max)));
      }
    }
    min = -max;

    for (const field of currentState.graph.fields) {
      setMin(field, min);
      setMax(field, max);
    }
    emitUpdate();
  }
}

const menuItems = [
  [
    {
      label: 'Like this one',
      onSelect() {
        setMinMaxLikeThis();
      },
    },
    {
      label: 'Full range',
      disabled: true,
    },
    {
      label: 'One scale',
      onSelect() {
        setMinMaxOneScale();
      },
    },
    {
      label: 'Centered',
      onSelect() {
        setMinMaxCentered();
      },
    },
  ],
  [
    {
      label: 'Zoom In',
      disabled: true,
    },
    {
      label: 'Zoom Out',
      disabled: true,
    },
  ],
  [
    {
      label: 'Default',
      onSelect() {
        setMinMaxToDefault();
      },
    },
  ],
  [
    {
      label: 'current field menu',
      children: [
        [
          { label: 'Full range', disabled: true },
          { label: 'Centered', disabled: true },
        ],
        [
          { label: 'Zoom In', disabled: true },
          { label: 'Zoom Out', disabled: true },
        ],
        [
          { label: 'Default', disabled: true },
        ],
      ],
    },
  ],
  [
    {
      label: '\u25BCClose',
    },
  ],
];

</script>
