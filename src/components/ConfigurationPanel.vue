<template>
  <div v-show="graphStore.hasConfig" class="overflow-y-auto p-4 bg-elevated">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold">Configuration</h3>
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search parameters..."
        size="sm"
        class="w-64"
      />
    </div>

    <table class="w-full text-sm">
      <thead class="sr-only">
        <tr>
          <th>Parameter</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="param in filteredParams"
          :key="param.name"
          class="border-b border-default"
        >
          <td class="py-1 pr-4 text-dimmed font-mono text-xs">
            {{ param.name }}
          </td>
          <td class="py-1 font-mono text-xs">{{ param.value }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useGraphStore } from "../stores/graph.js";

const graphStore = useGraphStore();

const props = defineProps({
  params: {
    type: Array,
    default: () => [],
  },
});

const search = ref("");

const filteredParams = computed(() => {
  if (!search.value) {
    return props.params;
  }
  const q = search.value.toLowerCase();
  return props.params.filter(
    (p) =>
      (p.name ?? "").toLowerCase().includes(q) ||
      String(p.value ?? "")
        .toLowerCase()
        .includes(q),
  );
});
</script>
