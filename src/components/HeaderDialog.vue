<template>
  <UModal v-model:open="open" :ui="{ width: 'max-w-4xl' }">
    <template #header>
      <div>
        <h4 class="font-semibold">{{ craftName }}</h4>
        <p class="text-sm text-neutral-500">{{ revision }}</p>
      </div>
    </template>

    <template #body>
      <div class="grid grid-cols-2 gap-6 p-4">
        <!-- PID Settings -->
        <div>
          <h5 class="font-semibold mb-2">PID Settings</h5>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b dark:border-neutral-700">
                <th class="text-left py-1" />
                <th class="text-center py-1">P</th>
                <th class="text-center py-1">I</th>
                <th class="text-center py-1">D</th>
                <th class="text-center py-1">FF</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="axis in ['Roll', 'Pitch', 'Yaw']" :key="axis" class="border-b dark:border-neutral-800">
                <td class="py-1 font-medium">{{ axis }}</td>
                <td v-for="col in ['p', 'i', 'd', 'f']" :key="col" class="text-center py-1">
                  {{ getPidValue(axis, col) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Parameters -->
        <div>
          <h5 class="font-semibold mb-2">Parameters</h5>
          <div class="max-h-96 overflow-y-auto">
            <table class="w-full text-sm">
              <tbody>
                <tr
                  v-for="param in parameters"
                  :key="param.name"
                  class="border-b dark:border-neutral-800"
                >
                  <td class="py-1 text-neutral-600 dark:text-neutral-400">{{ param.name }}</td>
                  <td class="py-1">{{ param.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
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

const props = defineProps({
  craftName: { type: String, default: "" },
  revision: { type: String, default: "" },
  pidValues: { type: Object, default: () => ({}) },
  parameters: { type: Array, default: () => [] },
});

function getPidValue(axis, col) {
  return props.pidValues?.[axis.toLowerCase()]?.[col] ?? "-";
}
</script>
