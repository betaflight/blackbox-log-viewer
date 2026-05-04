<template>
  <div
    v-show="visible"
    class="flex flex-col gap-2 p-3 bg-neutral-50 dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 overflow-y-auto"
    :style="{ width: '260px' }"
  >
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">Legend</h3>
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-x"
        size="2xs"
        @click="$emit('close')"
      />
    </div>

    <div v-for="(graph, gi) in graphs" :key="gi" class="flex flex-col gap-1">
      <h4 class="text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {{ graph.label }}
      </h4>
      <ul class="flex flex-col gap-0.5">
        <li
          v-for="(field, fi) in graph.fields"
          :key="fi"
          class="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 text-sm"
          :class="{ 'opacity-40': !field.visible }"
          @click="$emit('toggle-visibility', gi, fi)"
          @mouseenter="$emit('highlight', gi, fi)"
          @mouseleave="$emit('highlight', -1, -1)"
        >
          <span
            class="w-3 h-3 rounded-sm shrink-0"
            :style="{ backgroundColor: field.color }"
          />
          <span class="truncate">{{ field.friendlyName || field.name }}</span>
        </li>
      </ul>
    </div>

    <!-- Override buttons -->
    <div class="flex items-center gap-1 mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-activity"
        size="2xs"
        :class="{ 'text-primary-500': expoOverride }"
        @click="$emit('toggle-expo')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-waves"
        size="2xs"
        :class="{ 'text-primary-500': smoothingOverride }"
        @click="$emit('toggle-smoothing')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-grid-3x3"
        size="2xs"
        :class="{ 'text-primary-500': gridOverride }"
        @click="$emit('toggle-grid')"
      />
    </div>

    <UButton
      color="primary"
      variant="outline"
      label="Graph setup"
      block
      @click="$emit('open-config')"
    />
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: true },
  graphs: { type: Array, default: () => [] },
  expoOverride: { type: Boolean, default: false },
  smoothingOverride: { type: Boolean, default: false },
  gridOverride: { type: Boolean, default: false },
});

defineEmits([
  "close",
  "toggle-visibility",
  "highlight",
  "toggle-expo",
  "toggle-smoothing",
  "toggle-grid",
  "open-config",
]);
</script>
