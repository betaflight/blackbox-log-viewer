<template>
  <span id="seekbarToolbar" class="non-shift">
    <div id="seekbarType" class="seekBar-selection" title="Value to plot">
      <!-- Hidden native select populated by legacy renderSeekBarPicker() -->
    </div>
    <div id="seekbarTypeUSelect">
      <USelect
        v-model="seekbarType"
        :items="seekbarOptions"
        size="xs"
        class="w-full"
      />
    </div>
  </span>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";

const seekbarOptions = [
  { label: "Average motor throttle", value: "avgThrottle" },
  { label: "Maximum stick input", value: "maxRC" },
  { label: "Maximum motor differential", value: "maxMotorDiff" },
];

const seekbarType = ref("avgThrottle");

// Sync USelect → native select and dispatch change event for legacy code
watch(seekbarType, (val) => {
  const el = document.getElementById("seekbarTypeSelect");
  if (el) {
    el.value = val;
    el.dispatchEvent(new Event("change"));
  }
});

// Sync legacy → USelect when legacy code sets .value on the native select
onMounted(() => {
  // Wait for legacy renderSeekBarPicker() to create the native select
  const observer = new MutationObserver(() => {
    const el = document.getElementById("seekbarTypeSelect");
    if (!el) {
      return;
    }
    observer.disconnect();

    // Intercept .value setter
    const origDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    Object.defineProperty(el, "value", {
      get() { return origDesc.get.call(this); },
      set(v) {
        origDesc.set.call(this, v);
        seekbarType.value = String(v);
      },
    });

    // Sync initial value
    if (el.value) {
      seekbarType.value = el.value;
    }
  });

  const container = document.querySelector(".seekBar-selection");
  if (container) {
    observer.observe(container, { childList: true });
  }
});
</script>
