<template>
  <!-- View panel -->
  <li class="log-view-panel">
    <h4>View</h4>
    <div class="flex items-center gap-0.5">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-home"
        size="xs"
        title="View graph"
        @click="$emit('view-config')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-info"
        size="xs"
        title="View log header (H)"
        @click="$emit('open-header')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-table"
        size="xs"
        title="View table (T)"
        @click="$emit('toggle-table')"
      />
    </div>
  </li>
  <!-- Overlay panel -->
  <li class="log-overlay-panel">
    <h4>Overlay</h4>
    <div class="flex items-center gap-0.5">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-film"
        size="xs"
        title="Video"
        @click="$emit('toggle-video')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-plane"
        size="xs"
        title="Craft"
        @click="$emit('toggle-craft')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-gamepad-2"
        size="xs"
        title="Sticks"
        @click="$emit('toggle-sticks')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-bar-chart-3"
        size="xs"
        title="Analyser (A)"
        @click="$emit('toggle-analyser')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-map-pin"
        size="xs"
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
