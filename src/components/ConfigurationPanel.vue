<template>
  <div
    v-show="graphStore.hasConfig"
    class="overflow-y-auto p-4 bg-neutral-50 dark:bg-neutral-900"
  >
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
      <tbody>
        <tr
          v-for="param in filteredParams"
          :key="param.name"
          class="border-b dark:border-neutral-800"
        >
          <td class="py-1 pr-4 text-neutral-600 dark:text-neutral-400 font-mono text-xs">
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
  if (!search.value) return props.params;
  const q = search.value.toLowerCase();
  return props.params.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      String(p.value).toLowerCase().includes(q),
  );
});
</script>
