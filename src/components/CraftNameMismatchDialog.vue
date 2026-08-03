<template>
  <UModal v-model:open="open">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-triangle-alert" class="size-5 text-warning" />
        <h4 class="font-semibold">Configuration Mismatch</h4>
      </div>
    </template>

    <template #body>
      <p class="text-sm">{{ message }}</p>
      <p class="text-sm mt-2">Load a different configuration file?</p>
    </template>

    <template #footer>
      <div class="flex items-center gap-2">
        <UButton variant="soft" color="neutral" label="No" @click="open = false" />
        <UButton
          variant="solid"
          color="primary"
          label="Yes"
          @click="onYes"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup>
const open = defineModel("open", { type: Boolean, default: false });

defineProps({
  message: { type: String, default: "" },
});

const emit = defineEmits(["confirm"]);

function onYes() {
  open.value = false;
  emit("confirm");
}
</script>
