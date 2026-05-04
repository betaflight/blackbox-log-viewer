<template>
  <div v-if="!logStore.hasLog" class="flex flex-col items-center justify-center min-h-[60vh] gap-8 p-8">
    <div class="text-center max-w-2xl">
      <h1 class="text-3xl font-bold mb-4">Welcome to the Blackbox Explorer</h1>
      <p class="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
        Analyze logs created by Betaflight's Blackbox feature.
      </p>
      <LogFileInput size="lg" label="Open log file/video" @files-selected="$emit('files-selected', $event)" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl w-full">
      <UCard>
        <template #header>
          <span class="font-semibold">Introduction to Blackbox</span>
        </template>
        <p>
          The Blackbox feature is built in to
          <a href="https://github.com/betaflight/betaflight/releases" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">Betaflight</a>
          and is supported on most modern flight controllers.
        </p>
        <p class="mt-2">
          Read the
          <a href="https://github.com/betaflight/betaflight/blob/master/docs/Blackbox.md" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">Blackbox documentation</a>
          to get started with recording.
        </p>
      </UCard>

      <UCard>
        <template #header>
          <span class="font-semibold">Tuning your craft</span>
        </template>
        <p>
          Blackbox logs reveal flight performance insights for tuning PIDs and filter settings.
        </p>
        <p class="mt-2">
          See
          <a href="https://github.com/betaflight/betaflight/blob/master/docs/PID-Tuning.md" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">PID tuning documentation</a>
          for guidance.
        </p>
      </UCard>

      <UCard>
        <template #header>
          <span class="font-semibold">Version</span>
        </template>
        <p>
          Latest version:
          <a href="https://blackbox.betaflight.com" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">blackbox.betaflight.com</a>
        </p>
        <p class="mt-2">
          Development version:
          <a href="https://master.blackbox.betaflight.com/" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">master.blackbox.betaflight.com</a>
        </p>
      </UCard>
    </div>
  </div>
</template>

<script setup>
import { useLogStore } from "../stores/log.js";
import LogFileInput from "./LogFileInput.vue";

defineEmits(["files-selected"]);
const logStore = useLogStore();
</script>
