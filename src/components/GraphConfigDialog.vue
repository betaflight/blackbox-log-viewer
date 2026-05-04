<template>
  <UModal v-model:open="open">
    <template #header>
      <h4 class="font-semibold">Configure graphs</h4>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-4">
        <div class="flex items-center justify-between">
          <UButton
            color="primary"
            icon="i-lucide-plus"
            label="Add graph"
            @click="$emit('add-graph')"
          />
          <UButton
            v-if="graphs.length > 0"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            label="Remove all"
            @click="$emit('remove-all')"
          />
        </div>

        <ul class="flex flex-col gap-2">
          <li
            v-for="(graph, index) in graphs"
            :key="index"
            class="p-3 rounded bg-neutral-100 dark:bg-neutral-800"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ graph.label || `Graph ${index + 1}` }}</span>
              <UButton
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                size="2xs"
                @click="$emit('remove-graph', index)"
              />
            </div>
            <div class="mt-2 flex flex-wrap gap-1">
              <span
                v-for="field in graph.fields"
                :key="field.name"
                class="text-xs px-2 py-0.5 rounded"
                :style="{ backgroundColor: field.color, color: '#fff' }"
              >
                {{ field.friendlyName || field.name }}
              </span>
            </div>
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          variant="outline"
          color="neutral"
          label="Cancel"
          @click="open = false"
        />
        <UButton
          color="primary"
          label="Apply changes"
          @click="onSave"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref } from "vue";

const open = defineModel("open", { type: Boolean, default: false });

defineProps({
  graphs: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["save", "add-graph", "remove-graph", "remove-all"]);

function onSave() {
  emit("save");
  open.value = false;
}
</script>
