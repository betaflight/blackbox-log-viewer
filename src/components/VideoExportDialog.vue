<template>
  <UModal v-model:open="open" :prevent-close="mode === 'progress'">
    <template #header>
      <h4 class="font-semibold">{{ title }}</h4>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-4">
        <!-- Settings mode -->
        <template v-if="mode === 'settings'">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Video duration</span>
            <span class="text-sm text-dimmed">{{ videoDurationText }}</span>
          </div>
          <p v-if="videoDurationText" class="text-xs text-dimmed">
            Use the I (In) and O (Out) keys while viewing the log to mark the start and end points of the video
          </p>

          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Framerate</span>
            <USelect v-model="frameRate" :items="frameRateOptions" :ui="{ content: 'z-[300]' }" class="w-40" />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Resolution</span>
            <USelect v-model="resolution" :items="resolutionOptions" :ui="{ content: 'z-[300]' }" class="w-40" />
          </div>

          <div v-if="hasFlightVideo" class="flex items-center justify-between">
            <span class="text-sm font-medium">Dim flight video</span>
            <USelect v-model="videoDim" :items="videoDimOptions" :ui="{ content: 'z-[300]' }" class="w-40" />
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Video format</span>
            <span class="text-sm text-dimmed">WebM</span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Audio format</span>
            <span class="text-sm text-dimmed">Not supported yet (no audio will be included)</span>
          </div>

          <p v-if="hasFlightVideo" class="text-xs text-dimmed">
            If you experience problems with the background flight video being glitchy in the exported video,
            <a href="https://github.com/betaflight/blackbox-tools/blob/master/Readme.md" target="_blank" rel="noopener noreferrer" class="underline">follow the instructions here</a>
            to re-encode your flight video.
          </p>
        </template>

        <!-- Progress mode -->
        <template v-else-if="mode === 'progress'">
          <UProgress :model-value="progressPercent" color="primary" size="sm" />
          <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <span class="text-dimmed">Rendered frames</span>
            <span>{{ renderedFramesText }}</span>
            <span class="text-dimmed">File size</span>
            <span>{{ fileSizeText }}</span>
            <template v-if="fileSizeWarning">
              <span></span>
              <span class="text-red-500 text-xs">You must install this tool as a Chrome App in order to export videos larger than 500MB</span>
            </template>
            <span class="text-dimmed">Remaining time</span>
            <span>{{ remainingText }}</span>
          </div>
        </template>

        <!-- Complete mode -->
        <template v-else>
          <p class="text-sm">{{ resultText }}</p>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          v-if="mode !== 'complete'"
          variant="outline"
          color="neutral"
          label="Cancel"
          @click="onCancel"
        />
        <UButton
          v-if="mode === 'complete'"
          variant="outline"
          color="neutral"
          label="Close"
          @click="open = false"
        />
        <UButton
          v-if="mode === 'settings'"
          color="primary"
          label="Begin export"
          @click="onStartExport"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { FlightLogVideoRenderer } from "../flightlog_video_renderer.js";

const open = defineModel("open", { type: Boolean, default: false });

const props = defineProps({
  flightLog: { type: Object, default: null },
  logParameters: { type: Object, default: null },
  videoConfig: { type: Object, default: null },
});

const emit = defineEmits(["save-config"]);

// Settings
const frameRate = ref("30");
const resolution = ref("1920x1080");
const videoDim = ref("0.4");

const frameRateOptions = [
  { label: "15 fps", value: "15" },
  { label: "23.976 fps", value: "23.976" },
  { label: "24 fps", value: "24" },
  { label: "25 fps", value: "25" },
  { label: "29.97 fps", value: "29.97" },
  { label: "30 fps", value: "30" },
  { label: "50 fps", value: "50" },
  { label: "59.94 fps", value: "59.94" },
  { label: "60 fps", value: "60" },
  { label: "120 fps", value: "120" },
  { label: "240 fps", value: "240" },
];

const resolutionOptions = [
  { label: "480p", value: "854x480" },
  { label: "720p", value: "1280x720" },
  { label: "1080p", value: "1920x1080" },
];

const videoDimOptions = [
  { label: "0%", value: "0.0" },
  { label: "20%", value: "0.2" },
  { label: "40%", value: "0.4" },
  { label: "50%", value: "0.5" },
  { label: "60%", value: "0.6" },
  { label: "80%", value: "0.8" },
  { label: "100%", value: "1.0" },
];

// State
const mode = ref("settings");
const progressValue = ref(0);
const progressMax = ref(100);
const renderedFramesText = ref("");
const fileSizeText = ref("");
const fileSizeWarning = ref(false);
const remainingText = ref("");
const resultText = ref("");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let videoRenderer: any = null;
let renderStartTime = 0;
let lastEstimatedTimeMsec: number | null = null;

const hasFlightVideo = computed(() => !!props.logParameters?.flightVideo);

const progressPercent = computed(() => {
  if (progressMax.value <= 0) {
    return 0;
  }
  return Math.round((progressValue.value / progressMax.value) * 100);
});

const videoDurationText = computed(() => {
  if (!props.logParameters) {
    return "";
  }
  const inTime = props.logParameters.inTime ?? props.flightLog?.getMinTime() ?? 0;
  const outTime = props.logParameters.outTime ?? props.flightLog?.getMaxTime() ?? 0;
  return formatTime(Math.round((outTime - inTime) / 1000000));
});

const title = computed(() => {
  if (mode.value === "progress") {
    return "Rendering video...";
  }
  if (mode.value === "complete") {
    return "Video rendering complete!";
  }
  return "Export video";
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function populateConfig(cfg: Record<string, any>) {
  if (cfg.frameRate) {
    frameRate.value = String(cfg.frameRate);
  }
  if (cfg.width) {
    resolution.value = `${cfg.width}x${cfg.height}`;
  }
  if (cfg.videoDim !== undefined) {
    // Find closest match
    const best = videoDimOptions.reduce((prev, cur) =>
      Math.abs(Number.parseFloat(cur.value) - cfg.videoDim) < Math.abs(Number.parseFloat(prev.value) - cfg.videoDim) ? cur : prev,
    videoDimOptions[0]);
    videoDim.value = best.value;
  }
}

function buildVideoConfig() {
  const [w, h] = resolution.value.split("x").map((v) => Number.parseInt(v, 10));
  return {
    frameRate: Number.parseFloat(frameRate.value),
    videoDim: Number.parseFloat(videoDim.value),
    width: w,
    height: h,
  };
}

function leftPad(value: string | number, pad: string, width: number) {
  value = `${value}`;
  while (value.length < width) { value = pad + value; }
  return value;
}

function formatTime(secs: number) {
  let mins = Math.floor(secs / 60);
  secs = secs % 60;
  const hours = Math.floor(mins / 60);
  mins = mins % 60;
  if (hours) {
    return `${hours}:${leftPad(mins, "0", 2)}:${leftPad(secs, "0", 2)}`;
  }
  return `${mins}:${leftPad(secs, "0", 2)}`;
}

function formatFilesize(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

function onStartExport() {
  const videoConfig = buildVideoConfig();
  emit("save-config", videoConfig);

  const logParams = { ...props.logParameters };
  if (!("inTime" in logParams) || logParams.inTime === false) {
    logParams.inTime = props.flightLog.getMinTime();
  }
  if (!("outTime" in logParams) || logParams.outTime === false) {
    logParams.outTime = props.flightLog.getMaxTime();
  }

  let lastWrittenBytes = 0;

  // FlightLogVideoRenderer is an Option-A typed-`this` fn; cast restores `new`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  videoRenderer = new (FlightLogVideoRenderer as any)(
    props.flightLog,
    logParams,
    videoConfig,
    {
      onProgress(frameIndex: number, frameCount: number) {
        progressMax.value = frameCount - 1;
        progressValue.value = frameIndex;
        renderedFramesText.value = `${frameIndex + 1} / ${frameCount} (${(((frameIndex + 1) / frameCount) * 100).toFixed(1)}%)`;

        if (frameIndex > 0) {
          const elapsedTimeMsec = Date.now() - renderStartTime;
          const estimatedTimeMsec = (elapsedTimeMsec * frameCount) / frameIndex;

          lastEstimatedTimeMsec = estimatedTimeMsec;

          const estimatedRemaining = Math.max(Math.round((lastEstimatedTimeMsec - elapsedTimeMsec) / 1000), 0);
          remainingText.value = formatTime(estimatedRemaining);

          const writtenBytes = videoRenderer.getWrittenSize();
          const estimatedBytes = Math.round((frameCount / frameIndex) * writtenBytes);

          if (writtenBytes !== lastWrittenBytes) {
            lastWrittenBytes = writtenBytes;
            if (writtenBytes > 1000000) {
              fileSizeText.value = `${formatFilesize(writtenBytes)} / ${formatFilesize(estimatedBytes)}`;
              fileSizeWarning.value = !videoRenderer.willWriteDirectToDisk() && estimatedBytes >= 475 * 1024 * 1024;
            }
          }
        }
      },
      onComplete(success: boolean, frameCount: number) {
        if (success) {
          resultText.value = `Rendered ${frameCount} frames in ${formatTime(Math.round((Date.now() - renderStartTime) / 1000))}`;
          mode.value = "complete";
        } else {
          open.value = false;
        }
        videoRenderer = null;
      },
    },
  );

  progressValue.value = 0;
  renderedFramesText.value = "";
  remainingText.value = "";
  fileSizeText.value = "Calculating...";
  fileSizeWarning.value = false;
  mode.value = "progress";

  renderStartTime = Date.now();
  lastEstimatedTimeMsec = null;
  videoRenderer.start();
}

function onCancel() {
  if (videoRenderer) {
    videoRenderer.cancel();
    videoRenderer = null;
  }
  open.value = false;
}

// Reset state when dialog opens
watch(open, (val) => {
  if (val) {
    mode.value = "settings";
    progressValue.value = 0;
    renderedFramesText.value = "";
    remainingText.value = "";
    fileSizeText.value = "";
    fileSizeWarning.value = false;
    resultText.value = "";
    if (props.videoConfig) { populateConfig(props.videoConfig); }
  } else if (videoRenderer) {
    videoRenderer.cancel();
    videoRenderer = null;
  }
});

onBeforeUnmount(() => {
  if (videoRenderer) {
    videoRenderer.cancel();
    videoRenderer = null;
  }
});
</script>
