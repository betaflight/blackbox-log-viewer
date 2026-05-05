<template>
  <div class="log-graph-config">
    <div class="flex items-center justify-between mb-2">
      <h2 id="legend_title" class="text-lg font-semibold m-0">Legend</h2>
      <UButton
        class="log-close-legend-dialog"
        variant="ghost"
        color="neutral"
        icon="i-lucide-x"
        size="2xs"
        title="Hide the legend"
      />
    </div>
    <div class="log-index"></div>
    <div class="log-graph-legend">
    </div>

    <fieldset class="flex gap-1 override-button-group my-2">
      <UButton variant="ghost" color="neutral" size="xs" class="toggle-expo" title="Expo On/Off" @click="toggleExpo">
        <svg width="20" height="20" viewBox="0 0 8.467 8.467">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width=".5" d="M0 4.233s2.117 5.292 4.233 0c2.117-5.291 4.234 0 4.234 0"/>
          <path fill="currentColor" d="M4.233 0L3.175 1.058h2.117L4.233 0zm0 1.058L3.175 2.117h.794V6.35h-.794l1.058 1.058L5.292 6.35h-.794V2.117h.794L4.233 1.058zm0 6.35H3.175l1.058 1.059 1.059-1.059H4.233z"/>
        </svg>
      </UButton>
      <UButton variant="ghost" color="neutral" size="xs" class="toggle-smoothing" title="Smoothing On/Off" @click="toggleSmoothing">
        <svg width="20" height="20" viewBox="0 0 8.467 8.467">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width=".5" d="M0 4.233s2.117 5.292 4.233 0c2.117-5.291 4.234 0 4.234 0"/>
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=".265"
            d="M0 4.233l1.058 3.97 1.059-2.911 1.058 2.91 1.058-7.144 1.059 4.234L6.35.265l1.058 3.968h1.059"/>
        </svg>
      </UButton>
      <UButton variant="ghost" color="neutral" size="xs" class="toggle-grid" title="Grid On/Off" @click="toggleGrid">
        <svg width="20" height="20" viewBox="0 0 8.467 8.467">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width=".5" d="M0 4.233s2.117 5.292 4.233 0c2.117-5.291 4.234 0 4.234 0"/>
          <g fill="none" stroke="currentColor" stroke-width=".198">
            <path d="M0 3.175h8.467M0 7.408h8.467M0 5.292h8.467M0 1.058h8.467" opacity=".75"/>
          </g>
        </svg>
      </UButton>
    </fieldset>

    <UButton color="primary" variant="solid" block size="xs" class="open-graph-configuration-dialog text-black" label="Graph setup" />
  </div>
</template>

<script setup>
function getLegacy() {
  return globalThis.blackboxLogViewer;
}

function toggleExpo() {
  getLegacy()?.toggleExpo?.();
}

function toggleSmoothing() {
  getLegacy()?.toggleSmoothing?.();
}

function toggleGrid() {
  getLegacy()?.toggleGrid?.();
}
</script>
