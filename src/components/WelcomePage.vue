<template>
  <div v-if="!logStore.hasLog" class="flex flex-col items-center justify-center min-h-[60vh] gap-8 p-8">
    <div class="text-center max-w-2xl">
      <h1 class="text-3xl font-bold mb-4">Welcome to the Blackbox Explorer</h1>
      <p class="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
        Analyze logs created by Betaflight's Blackbox feature.
      </p>
      <LogFileInput size="lg" label="Open log file/video" @files-selected="$emit('files-selected', $event)" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl w-full">
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
          To get started with Blackbox recording, read
          <a href="https://github.com/betaflight/betaflight/blob/master/docs/Blackbox.md" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">Betaflight's Blackbox feature documentation</a>.
        </p>
        <p class="mt-2">
          Already have a log recorded? View
          <a href="https://github.com/betaflight/blackbox-tools/blob/master/Readme.md" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">the documentation for this log viewer</a>
          for details on how to best use this tool.
        </p>
        <p class="mt-2">
          Found a bug or have a suggestion? Add it to
          <a href="https://github.com/betaflight/blackbox-log-viewer/issues" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">the viewer's GitHub bug tracker</a>.
        </p>
      </UCard>

      <UCard>
        <template #header>
          <span class="font-semibold">Tuning your craft</span>
        </template>
        <p>
          The Blackbox can deliver insights on your flight performance that will allow you to tune variables such as your PIDs and
          low-pass filter settings.
        </p>
        <p class="mt-2">For help and instructions on how to tune your craft:</p>
        <ul class="list-disc pl-5 mt-1 space-y-1 text-sm">
          <li>
            <a href="https://github.com/betaflight/betaflight/blob/master/docs/PID-Tuning.md" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">Betaflight's PID tuning documentation</a>
          </li>
          <li>
            <a href="http://www.rcgroups.com/forums/showthread.php?t=2439428" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">Mini quad PID tuning from start to finish</a> by Joshua Bardwell
          </li>
          <li>
            <a href="http://www.rcgroups.com/forums/showthread.php?t=2386267" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">Blackbox log analyzation/help thread</a> on RCGroups.com
          </li>
        </ul>
      </UCard>

      <UCard>
        <template #header>
          <span class="font-semibold">Other tools</span>
        </template>
        <p>
          Use the
          <a href="https://github.com/betaflight/blackbox-tools/" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">blackbox_decode tool</a>
          to convert your log file into a CSV file for analysis in tools like Matlab.
        </p>
        <p class="mt-2">
          To share your log as a video, use the "export video" button at the top to render a WebM video, or the
          <a href="https://github.com/betaflight/blackbox-tools/" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">blackbox_render tool</a>
          to turn your log into a series of PNG files.
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
