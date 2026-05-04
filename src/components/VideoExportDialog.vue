<template>
  <UModal v-model:open="open">
    <template #header>
      <h4 class="font-semibold">Export video</h4>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-4">
        <!-- Settings mode -->
        <template v-if="mode === 'settings'">
          <div class="flex items-center justify-between">
            <span class="text-sm">Width</span>
            <UInput v-model.number="width" type="number" class="w-24" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">Height</span>
            <UInput v-model.number="height" type="number" class="w-24" />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">Framerate</span>
            <UInput v-model.number="framerate" type="number" class="w-24" />
          </div>
        </template>

        <!-- Progress mode -->
        <template v-else-if="mode === 'progress'">
          <div class="flex flex-col gap-2">
            <progress :value="progress" max="100" class="w-full h-2" />
            <div class="flex justify-between text-sm text-neutral-500">
              <span>{{ renderedFrames }} frames</span>
              <span>{{ remaining }}</span>
              <span>{{ fileSize }}</span>
            </div>
          </div>
        </template>

        <!-- Complete mode -->
        <template v-else>
          <p class="text-sm">Export complete. Click download to save.</p>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          variant="outline"
          color="neutral"
          :label="mode === 'complete' ? 'Close' : 'Cancel'"
          @click="onCancel"
        />
        <UButton
          v-if="mode === 'settings'"
          color="primary"
          label="Start export"
          @click="$emit('start-export', { width, height, framerate })"
        />
        <UButton
          v-if="mode === 'complete'"
          color="primary"
          label="Download"
          icon="i-lucide-download"
          @click="$emit('download')"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref } from "vue";

const open = defineModel("open", { type: Boolean, default: false });

defineProps({
  mode: { type: String, default: "settings" },
  progress: { type: Number, default: 0 },
  renderedFrames: { type: String, default: "0" },
  remaining: { type: String, default: "" },
  fileSize: { type: String, default: "" },
});

const emit = defineEmits(["start-export", "download", "cancel"]);

const width = ref(1920);
const height = ref(1080);
const framerate = ref(30);

function onCancel() {
  emit("cancel");
  open.value = false;
}
</script>
