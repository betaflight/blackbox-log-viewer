<template>
  <UButton
    :size="size"
    color="primary"
    :label="label"
    icon="i-lucide-folder-open"
    @click="fileInput?.click()"
  />
  <input
    ref="fileInput"
    type="file"
    class="hidden"
    accept=".bbl,.txt,.cfl,.bfl,.log,.avi,.mov,.mp4,.mpeg,.json"
    multiple
    @change="onFileChange"
  />
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps({
  size: {
    type: String,
    default: "sm",
  },
  label: {
    type: String,
    default: "Open log file/video",
  },
});

const emit = defineEmits(["files-selected"]);
const fileInput = ref<HTMLInputElement | null>(null);

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    emit("files-selected", files);
  }
  // Reset input so same file can be selected again
  target.value = "";
}
</script>
