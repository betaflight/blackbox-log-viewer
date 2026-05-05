<template>
  <div id="analyser" class="analyser">
    <canvas width="0" height="0" id="analyserCanvas"></canvas>

    <span id="spectrumToolbar" class="non-shift">
      <div id="spectrumType" title="Type of Spectrum">
        <!-- Hidden native select for legacy graph_spectrum.js compat -->
        <select id="spectrumTypeSelect" class="hidden">
          <option v-for="o in spectrumTypeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <USelect
          v-model="spectrumType"
          :items="spectrumTypeOptions"
          size="xs"
          class="w-full"
          :ui="{ base: 'bg-neutral-800 text-white border-neutral-600' }"
        />
      </div>

      <div id="overdrawSpectrumType" title="Show Filters">
        <select id="overdrawSpectrumTypeSelect" class="hidden">
          <option v-for="o in overdrawOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <USelect
          v-model="overdrawType"
          :items="overdrawOptions"
          size="xs"
          class="w-full"
          :ui="{ base: 'bg-neutral-800 text-white border-neutral-600' }"
        />
      </div>

      <div id="spectrumButtons" class="spectrum-buttons">
        <div id="spectrumComparison" class="flex gap-1">
          <UButton id="btn-spectrum-export" size="xs" color="primary" label="Exp" title="Export spectrum to CSV" />
          <UButton size="xs" color="primary" label="Imp" title="Import spectrum from CSV" @click="triggerImport" />
          <input type="file" id="btn-spectrum-import" accept=".csv" class="hidden onlyFullScreenException" multiple/>
          <UButton id="btn-spectrum-clear" size="xs" color="primary" label="Clr" title="Clear imported spectrums" />
        </div>
        <div class="view-analyser-fullscreen flex items-center" @click="toggleFullscreen">
          <UButton
            color="primary"
            size="xs"
            class="icon-resize-full"
            icon="i-lucide-maximize-2"
            title="Maximize analyser"
          />
          <UButton
            color="primary"
            size="xs"
            class="icon-resize-small"
            icon="i-lucide-minimize-2"
            title="Minimize analyser"
          />
        </div>
      </div>
    </span>

    <!-- Hidden native inputs for legacy graph_spectrum.js compat -->
    <input id="analyserZoomX" class="hidden onlyFullScreenException" type="range" name="analyserZoomX" value="100" min="100" max="500" step="10" />
    <input id="analyserZoomY" class="hidden onlyFullScreenException" type="range" name="analyserZoomY" value="100" min="10" max="1000" step="10" />
    <!-- USlider wrappers positioned by CSS -->
    <div id="analyserZoomXSlider" class="onlyFullScreen analyser-slider-x">
      <USlider v-model="zoomX" :min="100" :max="500" :step="10" class="w-24" />
    </div>
    <div id="analyserZoomYSlider" class="onlyFullScreen analyser-slider-y">
      <USlider v-model="zoomY" :min="10" :max="1000" :step="10" class="w-24" />
    </div>
    <input id="analyserSegmentLengthPowerAt2" class="onlyFullScreen text-xs" type="number" name="analyserSegmentLengthPowerAt2" value="9" min="6" max="20" step="1" />
    <label id="analyserSegmentLengthPowerAt2Label" name="analyserSegmentLengthPowerAt2Label" class="onlyFullScreen text-xs text-dimmed">
      Segment&nbsp;length&nbsp;<br>power&nbsp;at&nbsp;2:
    </label>
    <input id="analyserLowLevelPSD" class="onlyFullScreen text-xs" type="number" name="analyserLowLevelPSD" value="-40" min="-40" max="10" step="5" />
    <label id="analyserLowLevelPSDLabel" name="analyserLowLevelPSDLabel" class="onlyFullScreen text-xs text-dimmed">
      Limit&nbsp;dBm
    </label>
    <input id="analyserMaxPSD" class="onlyFullScreen text-xs" type="number" name="analyserMaxPSD" value="10" min="-35" max="100" step="5" />
    <label id="analyserMaxPSDLabel" name="analyserMaxPSDLabel" class="onlyFullScreen text-xs text-dimmed">
      Max&nbsp;dBm
    </label>
    <input id="analyserMinPSD" class="onlyFullScreen text-xs" type="number" name="analyserMinPSD" value="-40" min="-100" max="5" step="5" />
    <label id="analyserMinPSDLabel" name="analyserMinPSDLabel" class="onlyFullScreen text-xs text-dimmed">
      Min&nbsp;dBm
    </label>

  </div>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";

const spectrumTypeOptions = [
  { label: "Frequency", value: "0" },
  { label: "Freq. vs Throttle", value: "1" },
  { label: "Freq. vs RPM", value: "2" },
  { label: "Power Spectral Density", value: "3" },
  { label: "PSD vs Throttle", value: "4" },
  { label: "PSD vs RPM", value: "5" },
  { label: "Error vs Setpoint", value: "6" },
];

const overdrawOptions = [
  { label: "Show all filters", value: "0" },
  { label: "Show only Gyro filters", value: "1" },
  { label: "Show only D-Term filters", value: "2" },
  { label: "Show only Yaw filters", value: "3" },
  { label: "Hide all filters", value: "4" },
  { label: "Auto", value: "5" },
];

const spectrumType = ref("0");
const overdrawType = ref("0");
const zoomX = ref(100);
const zoomY = ref(100);

// Sync USelect → hidden native select and dispatch change event for legacy code
watch(spectrumType, (val) => {
  const el = document.getElementById("spectrumTypeSelect");
  if (el) {
    el.value = val;
    el.dispatchEvent(new Event("change"));
  }
});

watch(overdrawType, (val) => {
  const el = document.getElementById("overdrawSpectrumTypeSelect");
  if (el) {
    el.value = val;
    el.dispatchEvent(new Event("change"));
  }
});

// Sync USlider → hidden native range input and dispatch input event for legacy code
watch(zoomX, (val) => {
  const el = document.getElementById("analyserZoomX");
  if (el) {
    el.value = val;
    el.dispatchEvent(new Event("input"));
  }
});

watch(zoomY, (val) => {
  const el = document.getElementById("analyserZoomY");
  if (el) {
    el.value = val;
    el.dispatchEvent(new Event("input"));
  }
});

// Sync legacy → USelect/USlider when legacy code sets .value on hidden elements
onMounted(() => {
  const specEl = document.getElementById("spectrumTypeSelect");
  const overdrawEl = document.getElementById("overdrawSpectrumTypeSelect");

  if (specEl) {
    // Observe value changes from legacy code via MutationObserver on the value property
    const origSpecDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    Object.defineProperty(specEl, "value", {
      get() { return origSpecDesc.get.call(this); },
      set(v) {
        origSpecDesc.set.call(this, v);
        spectrumType.value = String(v);
      },
    });
  }

  if (overdrawEl) {
    const origOverDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    Object.defineProperty(overdrawEl, "value", {
      get() { return origOverDesc.get.call(this); },
      set(v) {
        origOverDesc.set.call(this, v);
        overdrawType.value = String(v);
      },
    });
  }

  // Intercept .value setter on hidden range inputs for legacy sync
  const zoomXEl = document.getElementById("analyserZoomX");
  const zoomYEl = document.getElementById("analyserZoomY");
  const origInputDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  if (zoomXEl) {
    Object.defineProperty(zoomXEl, "value", {
      get() { return origInputDesc.get.call(this); },
      set(v) {
        origInputDesc.set.call(this, v);
        zoomX.value = Number(v);
      },
    });
  }

  if (zoomYEl) {
    Object.defineProperty(zoomYEl, "value", {
      get() { return origInputDesc.get.call(this); },
      set(v) {
        origInputDesc.set.call(this, v);
        zoomY.value = Number(v);
      },
    });
  }
});

function triggerImport() {
  document.getElementById("btn-spectrum-import").click();
}

function toggleFullscreen() {
  globalThis.blackboxLogViewer?.toggleAnalyserFullscreen?.();
}
</script>
