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

      <div id="spectrumComparison" class="spectrum-actions">
        <UDropdownMenu :items="spectrumMenuItems">
          <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-ellipsis" title="Spectrum actions" :ui="{ base: 'bg-neutral-800 text-white border-neutral-600' }" />
        </UDropdownMenu>
        <!-- Hidden elements for legacy JS click handlers -->
        <button id="btn-spectrum-export" class="hidden" />
        <input type="file" id="btn-spectrum-import" accept=".csv" class="hidden onlyFullScreenException" multiple/>
        <button id="btn-spectrum-clear" class="hidden" />
      </div>

      <div id="spectrumButtons" class="spectrum-buttons">
        <div class="view-analyser-fullscreen flex items-center" @click="toggleFullscreen">
          <UButton
            variant="outline"
            color="neutral"
            size="xs"
            class="icon-resize-full"
            icon="i-lucide-maximize-2"
            title="Maximize analyser"
            :ui="{ base: 'bg-neutral-800 text-white border-neutral-600' }"
          />
          <UButton
            variant="outline"
            color="neutral"
            size="xs"
            class="icon-resize-small"
            icon="i-lucide-minimize-2"
            title="Minimize analyser"
            :ui="{ base: 'bg-neutral-800 text-white border-neutral-600' }"
          />
        </div>
      </div>
    </span>

    <!-- Hidden native inputs for legacy graph_spectrum.js compat -->
    <input id="analyserZoomX" class="hidden onlyFullScreenException" type="range" name="analyserZoomX" value="100" min="100" max="500" step="10" />
    <input id="analyserZoomY" class="hidden onlyFullScreenException" type="range" name="analyserZoomY" value="100" min="10" max="1000" step="10" />
    <!-- USlider wrappers positioned by CSS -->
    <div id="analyserZoomXSlider" v-show="showSliderX" class="analyser-slider-x">
      <USlider v-model="zoomX" :min="100" :max="500" :step="10" class="w-24" />
    </div>
    <div id="analyserZoomYSlider" v-show="showSliderY" class="analyser-slider-y">
      <USlider v-model="zoomY" :min="10" :max="1000" :step="10" orientation="vertical" />
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useAppStore } from "../stores/app.js";
import { useGraphStore } from "../stores/graph.js";

const appStore = useAppStore();
const graphStore = useGraphStore();

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

// Slider visibility — controlled by Vue instead of CSS onlyFullScreen class
const zoomYException = ref(false);
let ySliderObserver = null;

const showSliderX = computed(() => graphStore.hasAnalyserFullscreen);
const showSliderY = computed(() => graphStore.hasAnalyserFullscreen && !zoomYException.value);

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

  // Watch for legacy code toggling onlyFullScreenException on Y slider
  const ySliderDiv = document.getElementById("analyserZoomYSlider");
  if (ySliderDiv) {
    ySliderObserver = new MutationObserver(() => {
      zoomYException.value = ySliderDiv.classList.contains("onlyFullScreenException");
    });
    ySliderObserver.observe(ySliderDiv, { attributes: true, attributeFilter: ["class"] });
  }
});

onBeforeUnmount(() => {
  ySliderObserver?.disconnect();
});

function triggerExport() {
  document.getElementById("btn-spectrum-export")?.click();
}

function triggerImport() {
  document.getElementById("btn-spectrum-import").click();
}

function triggerClear() {
  document.getElementById("btn-spectrum-clear")?.click();
}

const spectrumMenuItems = [
  [
    { label: "Export CSV", icon: "i-lucide-download", onSelect: triggerExport },
    { label: "Import CSV", icon: "i-lucide-upload", onSelect: triggerImport },
    { label: "Clear imported", icon: "i-lucide-trash-2", onSelect: triggerClear },
  ],
];

function toggleFullscreen() {
  appStore.controller?.toggleAnalyserFullscreen?.();
}
</script>
