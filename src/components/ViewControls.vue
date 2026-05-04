<template>
  <!-- View panel -->
  <li class="log-view-panel">
    <h4>View</h4>
    <div class="flex items-center gap-1">
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-home"
        size="sm"
        title="View graph"
        @click="$emit('view-config')"
      />
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-info"
        size="sm"
        title="View log header (H)"
        @click="$emit('open-header')"
      />
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-table"
        size="sm"
        title="View table (T)"
        @click="$emit('toggle-table')"
      />
    </div>
  </li>
  <!-- Overlay panel -->
  <li class="log-overlay-panel">
    <h4>Overlay</h4>
    <div class="flex items-center gap-1">
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-film"
        size="sm"
        title="Video"
        @click="$emit('toggle-video')"
      />
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-plane"
        size="sm"
        title="Craft"
        @click="$emit('toggle-craft')"
      />
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-gamepad-2"
        size="sm"
        title="Sticks"
        @click="$emit('toggle-sticks')"
      />
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-bar-chart-3"
        size="sm"
        title="Analyser (A)"
        @click="$emit('toggle-analyser')"
      />
      <UButton
        variant="solid"
        color="primary"
        icon="i-lucide-map-pin"
        size="sm"
        title="Map"
        @click="$emit('toggle-map')"
      />
    </div>
  </li>
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
