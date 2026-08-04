<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-[700px]' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-file-cog" class="size-5 text-primary" />
        <h4 class="font-semibold">Rotorflight Configuration</h4>
      </div>
    </template>

    <template #body>
      <div v-if="errorMessage" class="craft-config-error">{{ errorMessage }}</div>

      <div v-if="!craftConfigStore.hasConfig" class="craft-config-empty">
        <p class="text-sm text-dimmed">
          No Rotorflight configuration is loaded. Load a CLI <code>dump all</code> or
          <code>diff all</code> export to make the craft's configuration available across flight
          logs.
        </p>
        <UButton label="Choose File…" icon="i-lucide-folder-open" @click="chooseFile" />
      </div>

      <div v-else class="craft-config-details">
        <table class="craft-config-summary">
          <tbody>
            <tr>
              <td>Craft name</td>
              <td>{{ craftConfigStore.craftName || "(unnamed craft)" }}</td>
            </tr>
            <tr>
              <td>File</td>
              <td>{{ craftConfigStore.fileName }}</td>
            </tr>
            <tr>
              <td>Loaded</td>
              <td>{{ loadedAtText }}</td>
            </tr>
            <tr>
              <td>Settings parsed</td>
              <td>{{ craftConfigStore.settingCount }}</td>
            </tr>
          </tbody>
        </table>

        <UInput
          v-model="filter"
          placeholder="Enter filter"
          icon="i-lucide-search"
          size="sm"
          class="w-full mt-2"
        />

        <ul class="craft-config-list">
          <li v-for="(entry, i) in filteredLines" :key="i">
            <template v-if="entry.matchStart == null">{{ entry.text }}</template>
            <template v-else
              >{{ entry.text.slice(0, entry.matchStart)
              }}<b>{{ entry.text.slice(entry.matchStart, entry.matchStart + filter.length) }}</b
              >{{ entry.text.slice(entry.matchStart + filter.length) }}</template
            >
          </li>
        </ul>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept=".txt,.log"
        class="hidden"
        @change="onFileChange"
      />
    </template>

    <template #footer>
      <div class="flex items-center gap-2">
        <UButton variant="soft" color="neutral" label="Close" @click="open = false" />
        <div class="flex-1" />
        <UButton
          v-if="craftConfigStore.hasConfig"
          variant="soft"
          color="error"
          label="Clear"
          title="Remove the loaded configuration"
          @click="onClear"
        />
        <UButton
          v-if="craftConfigStore.hasConfig"
          variant="soft"
          color="neutral"
          label="Load different file…"
          title="Load a different configuration file"
          @click="chooseFile"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useCraftConfigStore } from "../stores/craftConfig.js";

const open = defineModel("open", { type: Boolean, default: false });

const craftConfigStore = useCraftConfigStore();

const fileInput = ref(null);
const filter = ref("");
const errorMessage = ref("");

const loadedAtText = computed(() =>
  craftConfigStore.loadedAt ? new Date(craftConfigStore.loadedAt).toLocaleString() : "-",
);

const filteredLines = computed(() => {
  const query = filter.value.trim().toLowerCase();
  const result = [];

  for (const text of craftConfigStore.lines) {
    if (!query) {
      if (text.length === 0) {
        continue;
      }
      result.push({ text, matchStart: null });
      continue;
    }

    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) {
      continue;
    }
    result.push({ text, matchStart: idx });
  }

  return result;
});

function chooseFile() {
  fileInput.value?.click();
}

function onFileChange(e) {
  const file = e.target.files[0];
  e.target.value = "";

  if (!file) {
    return;
  }

  craftConfigStore
    .loadFile(file)
    .then(() => {
      errorMessage.value = "";
      open.value = false;
    })
    .catch((err) => {
      errorMessage.value = `Could not load file: ${err.message}`;
    });
}

function onClear() {
  craftConfigStore.clear();
}

watch(open, (isOpen) => {
  if (isOpen) {
    errorMessage.value = "";
  }
});
</script>

<style scoped>
.craft-config-error {
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  color: var(--color-error-600, #b91c1c);
  background: var(--color-error-50, #fee2e2);
}

.craft-config-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.craft-config-summary td {
  padding: 0.15rem 0.5rem 0.15rem 0;
  font-size: 0.8rem;
  vertical-align: top;
}

.craft-config-summary td:first-child {
  font-weight: 600;
  white-space: nowrap;
  color: var(--text-dimmed);
}

.craft-config-list {
  height: 400px;
  overflow-y: auto;
  margin-top: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.375rem;
  list-style: none;
}

.craft-config-list li {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.7rem;
  white-space: pre;
}

.craft-config-list li:nth-child(even) {
  background: var(--ui-bg-elevated);
}
</style>
