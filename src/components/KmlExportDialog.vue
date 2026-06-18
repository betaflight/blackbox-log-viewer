<template>
  <UModal v-model:open="open" :prevent-close="mode === 'progress'">
    <template #header>
      <h4 class="font-semibold">Generate KML</h4>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-4">
        <!-- Settings mode -->
        <template v-if="mode === 'settings'">
          <p class="text-xs text-dimmed">
            Reconstruct the body-pose trajectory from the loaded blackbox log and export a
            georeferenced KML with a body-axis triad (nose&nbsp;=&nbsp;red, right&nbsp;=&nbsp;green,
            up&nbsp;=&nbsp;blue) drawn at each frame.
          </p>

          <!-- Triads per second -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Triads per second</span>
            <UInputNumber
              v-model="triadsPerSecond"
              :min="0.1"
              :step="0.5"
              :format-options="{ useGrouping: false }"
              class="w-40"
            />
          </div>

          <!-- Mag model JSON -->
          <div class="flex items-start justify-between gap-3">
            <span class="text-sm font-medium pt-1">Mag model (JSON)</span>
            <div class="flex flex-col items-end gap-1">
              <UButton
                variant="outline"
                color="neutral"
                size="xs"
                icon="i-lucide-upload"
                :label="magModel ? 'Replace file…' : 'Choose file…'"
                @click="pickMagModel"
              />
              <input
                ref="magFileInput"
                type="file"
                accept=".json,application/json"
                class="hidden"
                @change="onMagFileChange"
              />
              <span
                v-if="magModelName"
                class="text-xs text-dimmed max-w-[220px] truncate"
                :title="magModelName"
              >
                {{ magModelName }}
              </span>
            </div>
          </div>
          <p v-if="magError" class="text-xs text-red-500">{{ magError }}</p>
          <p v-else-if="!magModel" class="text-xs text-dimmed">
            Optional but recommended — the calibrated magnetometer model improves heading accuracy.
          </p>
        </template>

        <!-- Progress mode -->
        <template v-else-if="mode === 'progress'">
          <UProgress :model-value="progressPercent" color="primary" size="sm" />
          <p class="text-sm text-dimmed">{{ progressDetail }}</p>
        </template>

        <!-- Done mode -->
        <template v-else-if="mode === 'done'">
          <p class="text-sm">{{ resultText }}</p>
        </template>

        <!-- Error mode -->
        <template v-else>
          <p class="text-sm text-red-500">{{ errorText }}</p>
          <p v-if="errorHint" class="text-xs text-dimmed">{{ errorHint }}</p>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          v-if="mode === 'settings' || mode === 'progress'"
          variant="outline"
          color="neutral"
          label="Cancel"
          @click="onCancel"
        />
        <UButton
          v-if="mode === 'done' || mode === 'error'"
          variant="outline"
          color="neutral"
          label="Close"
          @click="open = false"
        />
        <UButton
          v-if="mode === 'settings'"
          color="primary"
          icon="i-lucide-globe"
          label="Generate KML"
          :disabled="!flightLog"
          @click="onGenerate"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, watch } from "vue";
import { generatePoseKml, PoseKmlNotImplemented } from "../pose/poseKmlExport.js";

const open = defineModel("open", { type: Boolean, default: false });

const props = defineProps({
  flightLog: { type: Object, default: null },
});

// Settings
const triadsPerSecond = ref(2);
const magModel = ref(null);
const magModelName = ref("");
const magError = ref("");
const magFileInput = ref(null);

// State machine: settings | progress | done | error
const mode = ref("settings");
const progressPercent = ref(0);
const progressDetail = ref("");
const resultText = ref("");
const errorText = ref("");
const errorHint = ref("");

let abortController = null;

// Coarse phase-weighted progress; refined once the real pipeline reports
// per-iteration fractions through onProgress.
const PHASE_BASE = { parsing: 0, estimating: 10, exporting: 90 };
const PHASE_SPAN = { parsing: 10, estimating: 80, exporting: 10 };

function pickMagModel() {
  magError.value = "";
  magFileInput.value?.click();
}

function onMagFileChange(e) {
  const file = e.target.files?.[0];
  e.target.value = ""; // allow re-selecting the same file later
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      magModel.value = JSON.parse(reader.result);
      magModelName.value = file.name;
      magError.value = "";
    } catch (err) {
      magModel.value = null;
      magModelName.value = "";
      magError.value = `Could not parse JSON: ${err.message}`;
    }
  };
  reader.onerror = () => {
    magError.value = "Could not read the selected file.";
  };
  reader.readAsText(file);
}

function onProgress(ev) {
  if (ev.detail) progressDetail.value = ev.detail;
  const base = PHASE_BASE[ev.phase] ?? 0;
  const span = PHASE_SPAN[ev.phase] ?? 0;
  progressPercent.value = Math.min(99, Math.round(base + span * (ev.fraction ?? 0)));
}

async function onGenerate() {
  mode.value = "progress";
  progressPercent.value = 0;
  progressDetail.value = "Starting…";
  abortController = new AbortController();
  try {
    const { filename, kml } = await generatePoseKml({
      flightLog: props.flightLog,
      magModel: magModel.value,
      triadsPerSecond: triadsPerSecond.value,
      onProgress,
      signal: abortController.signal,
    });
    downloadText(filename, kml, "application/vnd.google-earth.kml+xml");
    progressPercent.value = 100;
    resultText.value = `Saved ${filename}.`;
    mode.value = "done";
  } catch (err) {
    if (err?.name === "AbortError") {
      open.value = false;
      return;
    }
    if (err instanceof PoseKmlNotImplemented || err?.code === "NOT_IMPLEMENTED") {
      errorText.value = "Backend not wired yet — the interface is ready.";
      errorHint.value = err.message;
    } else {
      errorText.value = err?.message ?? String(err);
      errorHint.value = "";
    }
    mode.value = "error";
  } finally {
    abortController = null;
  }
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function onCancel() {
  if (abortController) {
    abortController.abort();
    return;
  }
  open.value = false;
}

// Reset transient state each time the dialog opens.
watch(open, (val) => {
  if (val) {
    mode.value = "settings";
    progressPercent.value = 0;
    progressDetail.value = "";
    resultText.value = "";
    errorText.value = "";
    errorHint.value = "";
    magError.value = "";
  } else if (abortController) {
    abortController.abort();
  }
});
</script>
