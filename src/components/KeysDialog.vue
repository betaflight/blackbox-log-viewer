<template>
  <UModal v-model:open="open">
    <template #header>
      <h4 class="font-semibold">Keyboard shortcuts</h4>
    </template>

    <template #body>
      <div class="p-4">
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="shortcut in shortcuts" :key="shortcut.key" class="border-b dark:border-neutral-800">
              <td class="py-2 pr-4">
                <kbd class="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-xs font-mono">
                  {{ shortcut.key }}
                </kbd>
              </td>
              <td class="py-2">{{ shortcut.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template #footer>
      <UButton
        variant="outline"
        color="neutral"
        label="Close"
        @click="open = false"
      />
    </template>
  </UModal>
</template>

<script setup>
const open = defineModel("open", { type: Boolean, default: false });

const shortcuts = [
  { key: "Space", description: "Play / Pause" },
  { key: "←  →", description: "Step through log" },
  { key: "Shift + ← →", description: "Jump through log" },
  { key: "Home / End", description: "Jump to start / end" },
  { key: "+ / -", description: "Zoom in / out" },
  { key: "T", description: "Toggle values table" },
  { key: "H", description: "Toggle header dialog" },
  { key: "A", description: "Toggle analyser" },
  { key: "M", description: "Toggle marker" },
  { key: "1-9", description: "Set bookmark" },
  { key: "Shift + 1-9", description: "Go to bookmark" },
  { key: "Ctrl + 1-9", description: "Clear bookmark" },
  { key: "Ctrl + Shift + 1-9", description: "Clear all bookmarks" },
];
</script>
