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

          <!-- Log-capability checklist -->
          <div class="border border-gray-200 rounded-md p-3">
            <p class="text-xs font-medium mb-2">Log data requirements</p>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1">
              <div class="flex items-center gap-1.5">
                <span :class="caps?.gyro ? 'text-green-600' : 'text-red-500'">
                  {{ caps?.gyro ? '&#x2713;' : '&#x2717;' }}
                </span>
                <span class="text-xs" :class="caps?.gyro ? 'text-dimmed' : 'text-red-600'">Gyroscope</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span :class="caps?.accel ? 'text-green-600' : 'text-red-500'">
                  {{ caps?.accel ? '&#x2713;' : '&#x2717;' }}
                </span>
                <span class="text-xs" :class="caps?.accel ? 'text-dimmed' : 'text-red-600'">Accelerometer</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span :class="caps?.mag ? 'text-green-600' : 'text-red-500'">
                  {{ caps?.mag ? '&#x2713;' : '&#x2717;' }}
                </span>
                <span class="text-xs" :class="caps?.mag ? 'text-dimmed' : 'text-red-600'">Magnetometer</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span :class="caps?.baro ? 'text-green-600' : 'text-red-500'">
                  {{ caps?.baro ? '&#x2713;' : '&#x2717;' }}
                </span>
                <span class="text-xs" :class="caps?.baro ? 'text-dimmed' : 'text-red-600'">Barometer</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span :class="caps?.gpsLockAtTakeoff ? 'text-green-600' : 'text-red-500'">
                  {{ caps?.gpsLockAtTakeoff ? '&#x2713;' : '&#x2717;' }}
                </span>
                <span class="text-xs" :class="caps?.gpsLockAtTakeoff ? 'text-dimmed' : 'text-red-600'">GPS lock at takeoff</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span :class="caps?.attitude ? 'text-green-600' : 'text-red-500'">
                  {{ caps?.attitude ? '&#x2713;' : '&#x2717;' }}
                </span>
                <span class="text-xs" :class="caps?.attitude ? 'text-dimmed' : 'text-red-600'">Attitude (quaternion)</span>
              </div>
            </div>
            <p v-if="caps && !caps.canGenerate" class="text-xs text-red-500 mt-2">
              Missing: {{ caps.missing.join(', ') }}
            </p>
          </div>

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
            Optional — the flight controller already fuses the magnetometer into the
            logged attitude. Upload a characterization model for additional refinement.
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
          :disabled="!flightLog || !caps?.canGenerate"
          @click="onGenerate"
        />
        <p
          v-if="mode === 'settings' && caps && !caps.canGenerate"
          class="text-xs text-red-500"
        >
          Cannot generate: {{ caps.missing.join(', ') }}
        </p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, watch, toRaw, type Ref } from "vue";
import { generatePoseKml } from "../pose/poseKmlExport.js";
import { analyzeLogCapabilities } from "../pose/logCapabilities.js";
import type { FlightLogHandle, LogCapabilities } from "../pose/logCapabilities.js";
import type { ProgressEvent } from "../pose/poseKmlExport.js";

const open = defineModel("open", { type: Boolean, default: false });

const props = defineProps({
  flightLog: { type: Object as () => unknown, default: null },
});

// Settings
const triadsPerSecond = ref(2);
const caps = ref<LogCapabilities | null>(null);
const magModel = ref<Record<string, unknown> | null>(null);
const magModelName = ref("");
const magError = ref("");
const magFileInput = ref<HTMLInputElement | null>(null);

// State machine: settings | progress | done | error
const mode = ref("settings");
const progressPercent = ref(0);
const progressDetail = ref("");
const resultText = ref("");
const errorText = ref("");
const errorHint = ref("");

let abortController: AbortController | null = null;

// Coarse phase-weighted progress; refined once the real pipeline reports
// per-iteration fractions through onProgress.
const PHASE_BASE = { parsing: 0, estimating: 10, exporting: 90 };
const PHASE_SPAN = { parsing: 10, estimating: 80, exporting: 10 };

function pickMagModel() {
  magError.value = "";
  magFileInput.value?.click();
}

function onMagFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // allow re-selecting the same file later
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      magModel.value = JSON.parse(reader.result as string);
      magModelName.value = file.name;
      magError.value = "";
    } catch (err) {
      magModel.value = null;
      magModelName.value = "";
      magError.value = `Could not parse JSON: ${(err as Error).message}`;
    }
  };
  reader.onerror = () => {
    magError.value = "Could not read the selected file.";
  };
  reader.readAsText(file);
}

function onProgress(ev: ProgressEvent) {
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
      // Detach from Vue reactivity: the flight log (store ref) and the loaded
      // mag model (ref) are reactive Proxies, and a Proxy cannot be cloned
      // across the Web Worker boundary. toRaw() hands over plain objects.
      flightLog: toRaw(props.flightLog),
      magModel: magModel.value ? toRaw(magModel.value) : null,
      triadsPerSecond: triadsPerSecond.value,
      onProgress,
      signal: abortController.signal,
    });
    downloadText(filename, kml, "application/vnd.google-earth.kml+xml");
    progressPercent.value = 100;
    resultText.value = `Saved ${filename}.`;
    mode.value = "done";
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.name === "AbortError") {
      open.value = false;
      return;
    }
    if (e.code === "NOT_IMPLEMENTED") {
      errorText.value = "Backend not available.";
      errorHint.value = e.message;
    } else {
      errorText.value = e.message ?? String(err);
      errorHint.value = "";
    }
    mode.value = "error";
  } finally {
    abortController = null;
  }
}

function downloadText(filename: string, text: string, mime: string) {
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
    // Probe log capabilities for the checklist
    try {
      caps.value = analyzeLogCapabilities(
        toRaw(props.flightLog) as FlightLogHandle | null,
      );
    } catch {
      caps.value = null;
    }
  } else if (abortController) {
    abortController.abort();
  }
});
</script>
