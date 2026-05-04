<template>
  <li class="log-workspace-panel">
    <h4>Workspace</h4>

    <UDropdownMenu :items="workspaceItems" class="w-full">
      <UButton
        variant="outline"
        block
        class="justify-between font-mono text-xs"
        trailing-icon="i-lucide-chevron-down"
      >
        <span v-if="activeEntry" class="flex items-center gap-1 truncate">
          <span class="opacity-70">{{ workspaceStore.activeWorkspace }}</span>
          <span class="truncate">{{ activeEntry.title }}</span>
        </span>
        <span v-else class="opacity-50">No workspace</span>
      </UButton>
    </UDropdownMenu>
  </li>
</template>

<script setup>
import { computed } from "vue";
import { useWorkspaceStore } from "../stores/workspace.js";

const emit = defineEmits([
  "switch-workspace",
  "save-workspace",
  "apply-default",
]);

const workspaceStore = useWorkspaceStore();

const activeEntry = computed(() => {
  const configs = workspaceStore.workspaceGraphConfigs;
  return configs?.[workspaceStore.activeWorkspace] ?? null;
});

const workspaceItems = computed(() => {
  const configs = workspaceStore.workspaceGraphConfigs;
  const switchItems = [];
  const saveItems = [];

  for (let index = 1; index < 11; index++) {
    const id = index % 10;
    const entry = configs?.[id];
    const isActive = id === workspaceStore.activeWorkspace;

    switchItems.push({
      label: entry ? `${id}  ${entry.title}` : `${id}  <empty>`,
      icon: isActive ? "i-lucide-check" : undefined,
      disabled: !entry,
      kbds: [`${id}`],
      onSelect() {
        if (entry) {
          emit("switch-workspace", id);
        }
      },
    });

    saveItems.push({
      label: `Save to ${id}`,
      icon: "i-lucide-save",
      kbds: ["shift", `${id}`],
      onSelect() {
        emit("save-workspace", id, entry?.title || "Unnamed");
      },
    });
  }

  const presetItems = [
    {
      label: "Preset: Ctzsnooze",
      icon: "i-lucide-layout-template",
      onSelect() {
        emit("apply-default", 1);
      },
    },
    {
      label: "Preset: SupaflyFPV",
      icon: "i-lucide-layout-template",
      onSelect() {
        emit("apply-default", 2);
      },
    },
  ];

  return [switchItems, saveItems, presetItems];
});
</script>
