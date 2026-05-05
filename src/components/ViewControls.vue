<template>
  <!-- View panel -->
  <div class="toolbar-panel log-view-panel">
    <h4>View</h4>
    <div class="flex items-center gap-0.5">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-home"
        size="xs"
        aria-label="View graph"
        title="View graph"
        @click="$emit('view-config')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-info"
        size="xs"
        aria-label="View log header"
        title="View log header (H)"
        @click="$emit('open-header')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-table"
        size="xs"
        aria-label="View table"
        title="View table (T)"
        @click="$emit('toggle-table')"
      />
    </div>
  </div>
  <!-- Overlay panel -->
  <div class="toolbar-panel log-overlay-panel">
    <h4>Overlay</h4>
    <div class="flex items-center gap-0.5">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-film"
        size="xs"
        aria-label="Video"
        title="Video"
        @click="$emit('toggle-video')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-plane"
        size="xs"
        aria-label="Craft"
        title="Craft"
        @click="$emit('toggle-craft')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-gamepad-2"
        size="xs"
        aria-label="Sticks"
        title="Sticks"
        @click="$emit('toggle-sticks')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-bar-chart-3"
        size="xs"
        aria-label="Analyser"
        title="Analyser (A)"
        @click="$emit('toggle-analyser')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-map-pin"
        size="xs"
        aria-label="Map"
        title="Map"
        @click="$emit('toggle-map')"
      />
    </div>
  </div>
</template>

<script setup>
defineEmits([
  "view-config",
  "open-header",
  "toggle-table",
  "toggle-video",
  "toggle-craft",
  "toggle-sticks",
  "toggle-analyser",
  "toggle-map",
]);
</script>
