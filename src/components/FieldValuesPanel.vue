<template>
  <div class="log-field-values" id="log-field-values">
    <h4 class="text-sm font-semibold px-2 py-1 bg-elevated rounded-t">Field values</h4>
    <UTable
      :data="logStore.fieldValues"
      :columns="valueColumns"
      :ui="{
        thead: '',
        base: 'w-full',
        th: 'px-1 py-0.5 text-xs',
        td: 'px-1 py-0.5 text-xs font-mono',
        tr: 'even:bg-elevated/50',
      }"
    />

    <h4 class="text-sm font-semibold px-2 py-1 bg-elevated mt-2 rounded-t">Statistics</h4>
    <p class="text-xs text-dimmed text-left px-2 py-0.5">Min/max values from this log</p>
    <UTable
      :data="logStore.fieldStats"
      :columns="statColumns"
      :ui="{
        thead: '',
        base: 'w-full',
        th: 'px-1 py-0.5 text-xs',
        td: 'px-1 py-0.5 text-xs font-mono',
        tr: 'even:bg-elevated/50',
      }"
    />
  </div>
</template>

<script setup>
import { useLogStore } from "../stores/log.js";

const logStore = useLogStore();

const valueColumns = [
  { accessorKey: "name1", header: " " },
  { accessorKey: "raw1", header: "Raw value" },
  { accessorKey: "decoded1", header: "Decoded" },
  { accessorKey: "name2", header: " " },
  { accessorKey: "raw2", header: "Raw value" },
  { accessorKey: "decoded2", header: "Decoded" },
];

const statColumns = [
  { accessorKey: "name", header: " " },
  { accessorKey: "min", header: "Min" },
  { accessorKey: "max", header: "Max" },
  { accessorKey: "mean", header: "Mean" },
];
</script>
