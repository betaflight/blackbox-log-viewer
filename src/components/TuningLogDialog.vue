<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-5xl' }">
    <template #header>
      <div class="flex items-center justify-between w-full gap-3 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <UIcon name="i-lucide-message-square" class="size-5 text-primary" />
          <h4 class="font-semibold">Tuning Log</h4>
          <span v-if="tuningLogStore.hasLog" class="text-xs text-dimmed">{{ tuningLogStore.currentLog.name }}</span>
          <span v-if="tuningLogStore.totalCostUsd" class="text-xs text-dimmed"
            >Total: {{ formatCost(tuningLogStore.totalCostUsd) }}</span
          >
        </div>
        <div class="flex items-center gap-1">
          <UButton variant="soft" color="neutral" size="xs" label="New…" @click="onNewClick" />
          <UButton variant="soft" color="neutral" size="xs" label="Import…" @click="onImportClick" />
          <UButton
            v-if="tuningLogStore.hasLog"
            variant="soft"
            color="neutral"
            size="xs"
            label="Export"
            icon="i-lucide-download"
            @click="tuningLogStore.exportToFile"
          />
        </div>
        <input ref="importInput" type="file" accept=".json" class="hidden" @change="onImportFileChange" />
      </div>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 text-sm">
        <p v-if="importError" class="text-xs text-error">{{ importError }}</p>

        <!-- Empty state -->
        <div v-if="!tuningLogStore.hasLog && !creatingNew" class="p-4 text-sm text-dimmed">
          <p>
            No tuning log is open yet. Create a new one, or import an existing tuning log
            <code>.json</code> file, using the buttons above.
          </p>
        </div>

        <!-- Create-new form -->
        <div v-else-if="creatingNew" class="flex flex-col gap-2 max-w-sm mx-auto my-8">
          <label class="text-sm font-medium">Tuning log name</label>
          <UInput v-model="newLogName" placeholder="e.g. craft name" size="sm" @keyup.enter="onCreateConfirm" />
          <p v-if="createError" class="text-xs text-error">{{ createError }}</p>
          <div class="flex justify-end gap-2 mt-2">
            <UButton variant="outline" color="neutral" label="Cancel" @click="creatingNew = false" />
            <UButton color="primary" label="Create…" @click="onCreateConfirm" />
          </div>
        </div>

        <!-- Log body: sidebar + main panel -->
        <div v-else class="flex gap-3 min-h-[28rem] max-h-[65vh]">
          <div class="w-56 shrink-0 flex flex-col border rounded-md border-default overflow-hidden">
            <div class="flex items-center justify-between px-2 py-1.5 border-b border-default text-xs font-medium">
              <span>Entries</span>
              <div class="flex items-center gap-0.5">
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="2xs"
                  icon="i-lucide-chevron-up"
                  title="Previous entry"
                  @click="step(-1)"
                />
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="2xs"
                  icon="i-lucide-chevron-down"
                  title="Next entry"
                  @click="step(1)"
                />
              </div>
            </div>
            <ul class="flex-1 overflow-y-auto">
              <li
                v-if="pinnedSlotVisible"
                class="px-2 py-1.5 border-b border-default cursor-pointer text-xs"
                :class="selectedEntryId === null ? 'bg-primary/15' : 'hover:bg-elevated'"
                @click="selectEntry(null)"
              >
                <div class="font-medium">Current flight log</div>
                <div class="text-dimmed">
                  {{ logStore.flightLog ? "Step response unavailable" : "No flight log open" }}
                </div>
              </li>
              <li
                v-for="entry in sidebarEntries"
                :key="entry.id"
                class="group px-2 py-1.5 border-b border-default cursor-pointer text-xs relative"
                :class="selectedEntryId === entry.id ? 'bg-primary/15' : 'hover:bg-elevated'"
                @click="selectEntry(entry.id)"
              >
                <div class="font-medium flex items-center gap-1 pr-5">
                  {{ entry.id === currentFlightLogEntryId ? "Current" : formatTimestamp(entry.timestamp) }}
                  <UTooltip
                    v-if="isBehindLatest(entry)"
                    text="The current log is not the latest entry in this tuning log"
                    :delay-duration="0"
                  >
                    <UIcon name="i-lucide-triangle-alert" class="size-3 text-warning" />
                  </UTooltip>
                  <UTooltip
                    v-if="entryHasAnalysis(entry)"
                    text="AI tuning advice has already been generated for this entry"
                    :delay-duration="0"
                  >
                    <UIcon name="i-lucide-check-circle-2" class="size-3 text-success" />
                  </UTooltip>
                </div>
                <div
                  v-if="entry.craftName"
                  class="italic truncate"
                  :class="entryCraftMismatch(entry) ? 'text-error font-medium' : 'text-dimmed'"
                  :title="
                    entryCraftMismatch(entry)
                      ? `Captured for “${entry.craftName}”, not this tuning log's craft (“${tuningLogStore.currentLog.craftName}”)`
                      : undefined
                  "
                >
                  {{ entry.craftName }}
                </div>
                <div class="text-dimmed">
                  {{ entry.id === currentFlightLogEntryId ? formatTimestamp(entry.timestamp) : "Read-only" }}
                  <template v-if="entryCost(entry)"> · {{ formatCost(entryCost(entry)) }}</template>
                </div>
                <UPopover
                  :open="confirmDeleteId === entry.id"
                  :ui="{ content: 'z-[300]' }"
                  @update:open="(v) => (confirmDeleteId = v ? entry.id : null)"
                >
                  <UButton
                    variant="ghost"
                    color="neutral"
                    size="2xs"
                    icon="i-lucide-trash-2"
                    title="Delete entry"
                    class="absolute top-1 right-1 opacity-0 group-hover:opacity-100"
                    :class="{ 'opacity-100': confirmDeleteId === entry.id }"
                    @click.stop
                  />
                  <template #content>
                    <div class="p-3 flex flex-col gap-2 w-56" @click.stop>
                      <p class="text-xs">Delete this tuning log entry? This cannot be undone.</p>
                      <div class="flex justify-end gap-2">
                        <UButton
                          variant="outline"
                          color="neutral"
                          size="xs"
                          label="Cancel"
                          @click="confirmDeleteId = null"
                        />
                        <UButton color="error" size="xs" label="Delete" @click="deleteEntry(entry.id)" />
                      </div>
                    </div>
                  </template>
                </UPopover>
              </li>
            </ul>
          </div>

          <div class="flex-1 min-w-0 flex flex-col gap-2 overflow-y-auto pr-1">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <h4 class="font-medium text-sm">{{ mainTitle }}</h4>
              <div class="flex items-center gap-1 flex-wrap">
                <UButton
                  v-if="hasImage"
                  variant="soft"
                  color="neutral"
                  size="xs"
                  :label="imageExpanded ? 'Shrink image' : 'Expand image'"
                  @click="imageExpanded = !imageExpanded"
                />
                <UButton
                  v-if="hasConfig"
                  variant="soft"
                  color="neutral"
                  size="xs"
                  :label="configVisible ? 'Hide config' : 'Expand config'"
                  @click="configVisible = !configVisible"
                />
                <UButton
                  v-if="hasImage"
                  variant="soft"
                  color="neutral"
                  size="xs"
                  icon="i-lucide-copy"
                  label="Copy Image"
                  @click="onCopyImage"
                />
                <UButton
                  v-if="hasImage && isCurrentFlightLog"
                  variant="soft"
                  color="neutral"
                  size="xs"
                  icon="i-lucide-copy"
                  label="Copy Prompt"
                  @click="onCopyPrompt"
                />
              </div>
            </div>

            <UAlert v-if="!hasImage" color="neutral" variant="soft" :description="noImageMessage" />
            <img
              v-if="hasImage"
              :src="currentEntry.image"
              class="rounded border border-default bg-black"
              :class="imageExpanded ? 'w-full' : 'max-h-64 object-contain'"
            />

            <pre
              v-if="hasConfig && configVisible"
              class="text-xs bg-elevated rounded p-2 max-h-64 overflow-y-auto whitespace-pre-wrap"
              >{{ currentEntry.config }}</pre
            >

            <div v-if="showNotes" class="flex flex-col gap-1">
              <label class="text-xs font-medium text-dimmed">Notes</label>
              <UTextarea
                v-model="notesDraft"
                :rows="2"
                :disabled="!isCurrentFlightLog"
                placeholder="What did you change? What are you trying to fix?"
                class="w-full"
                @blur="onNotesBlur"
              />
            </div>

            <div v-if="showAiPanel" class="border-t border-default pt-2 flex flex-col gap-2">
              <h4 class="text-xs font-semibold flex items-center gap-1">
                PID tuning advice
                <HelpIcon
                  text="Sends the step response image and configuration for this entry, plus whatever you type below. As context, it also sends the images, configs, notes and past AI answers from every other entry already saved in this tuning log."
                />
              </h4>

              <div v-if="conversationTurns.length || streamingText" class="flex flex-col gap-2">
                <div
                  v-for="(turn, i) in conversationTurns"
                  :key="i"
                  class="rounded p-2"
                  :class="
                    turn.role === 'user'
                      ? 'text-xs bg-elevated self-end max-w-[85%] ml-auto'
                      : 'bg-primary/10 prose prose-sm dark:prose-invert max-w-none'
                  "
                >
                  <template v-if="turn.role === 'user'">{{ turn.content }}</template>
                  <div v-else v-html="renderMarkdown(turn.content)" />
                </div>
                <div
                  v-if="streamingText"
                  class="rounded p-2 bg-primary/10 prose prose-sm dark:prose-invert max-w-none animate-pulse"
                  v-html="renderMarkdown(streamingText)"
                />
              </div>

              <UAlert
                v-if="showNoApiKeyBanner"
                color="warning"
                variant="soft"
                description="Asking AI needs an Anthropic API key. Add one under Settings → AI Analysis Settings."
                :close="true"
                @update:open="(v) => !v && tuningLogStore.dismissApiKeyBanner()"
              />

              <div v-if="showAskInput" class="flex flex-col gap-2">
                <label v-if="!hasConversation" class="flex items-center gap-2 text-xs font-normal">
                  Expert mode
                  <USwitch v-model="expertModeModel" size="xs" />
                  <HelpIcon
                    text="Also review filters, rates, feedforward, TPA, I-term relax and other configuration settings for improvements - not just PID gains."
                  />
                </label>
                <UTextarea
                  v-model="aiPromptText"
                  :rows="2"
                  :placeholder="hasConversation ? 'Ask a follow-up question…' : 'Anything specific you want help with? (optional)'"
                  class="w-full"
                />
                <div class="flex items-center gap-2 flex-wrap">
                  <UButton
                    color="primary"
                    size="xs"
                    label="AI Analysis"
                    :loading="isPending"
                    :disabled="isPending"
                    @click="onAskAi"
                  />
                  <span class="text-xs text-dimmed">Will use:</span>
                  <USelect v-model="modelModel" :items="modelOptions" size="xs" :disabled="isPending" class="w-52" />
                </div>
                <p v-if="aiError" class="text-xs text-error">{{ aiError }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton variant="outline" color="neutral" label="Close" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import HelpIcon from "./HelpIcon.vue";
import { useTuningLogStore } from "../stores/tuningLog.js";
import { useLogStore } from "../stores/log.js";
import { useGraphStore } from "../stores/graph.js";
import { useAppStore } from "../stores/app.js";
import { useSettingsStore } from "../stores/settings.js";
import * as TuningLog from "../tuning_log.js";
import * as TuningAI from "../tuning_ai.js";
import AI_MODELS from "../ai_models.json";

const open = defineModel("open", { type: Boolean, default: false });

const tuningLogStore = useTuningLogStore();
const logStore = useLogStore();
const graphStore = useGraphStore();
const appStore = useAppStore();
const settingsStore = useSettingsStore();

const modelOptions = AI_MODELS.models.map((m) => ({
  label: m.displayName + (m.description ? ` (${m.description})` : ""),
  value: m.id,
}));

// ---- Create / Import ----

const creatingNew = ref(false);
const newLogName = ref("");
const createError = ref("");
const importError = ref("");
const importInput = ref(null);

function onNewClick() {
  newLogName.value = sysConfig.value?.["Craft name"] || "";
  createError.value = "";
  creatingNew.value = true;
}

function onCreateConfirm() {
  const name = (newLogName.value || "").trim();
  if (!name) {
    createError.value = "Please enter a name for the tuning log.";
    return;
  }

  tuningLogStore.createLog(name, sysConfig.value?.["Craft name"] || "");
  creatingNew.value = false;
  selectedEntryId.value = null;
  syncSelectionToCurrentFlightLog();
}

function onImportClick() {
  importInput.value?.click();
}

function onImportFileChange(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;

  importError.value = "";
  tuningLogStore
    .importFromFile(file)
    .then(() => {
      selectedEntryId.value = null;
      syncSelectionToCurrentFlightLog();
    })
    .catch((err) => {
      importError.value = `Could not open the tuning log file: ${err.message}`;
    });
}

// ---- Selection / capture ----

const selectedEntryId = ref(null); // null = the pinned "current flight log" slot
const configVisible = ref(false);
const imageExpanded = ref(false);
const confirmDeleteId = ref(null);

const sysConfig = computed(() => logStore.flightLog?.getSysConfig?.() ?? null);

// The id the currently-open flight log's entry would have (whether or not it's been captured yet).
const currentFlightLogEntryId = computed(() => {
  if (!sysConfig.value) return null;
  return TuningLog.makeId(TuningLog.logTimestamp(sysConfig.value, appStore.logFileLastModified));
});

const currentFlightLogEntry = computed(() => {
  const id = currentFlightLogEntryId.value;
  if (!id) return null;
  return tuningLogStore.entries.find((entry) => entry.id === id) || null;
});

// The pinned "Current flight log" slot is only shown when there's nothing to point it at yet -
// once captured, the matching entry itself is shown instead of a duplicate placeholder row.
const pinnedSlotVisible = computed(() => !currentFlightLogEntry.value);

const sidebarEntries = computed(() => [...tuningLogStore.entries].reverse());

const currentEntry = computed(() => {
  if (selectedEntryId.value === null) return null;
  return tuningLogStore.entries.find((entry) => entry.id === selectedEntryId.value) || null;
});

const isCurrentFlightLog = computed(
  () => selectedEntryId.value === null || selectedEntryId.value === currentFlightLogEntryId.value,
);

function captureFromContext() {
  const flightLog = logStore.flightLog;
  const graph = graphStore.graph;
  if (!flightLog || !graph) return null;

  const stepResponse = graph.getStepResponse();
  if (!stepResponse) return null;

  const sc = flightLog.getSysConfig();

  return {
    image: stepResponse.captureImage(),
    config: TuningLog.buildConfigSummary(sc),
    notes: "",
    craftName: sc["Craft name"] || "",
    timestamp: TuningLog.logTimestamp(sc, appStore.logFileLastModified),
  };
}

/**
 * Adds an entry for the currently open flight log if it isn't already in the log - there's no
 * manual "Capture" step, this just runs whenever the dialog needs to be in sync (opening it,
 * creating/importing a log).
 */
function ensureCurrentFlightLogCaptured() {
  if (!tuningLogStore.hasLog || currentFlightLogEntry.value) return false;

  const capture = captureFromContext();
  if (!capture) return false;

  tuningLogStore.addEntry(capture);
  return true;
}

function syncSelectionToCurrentFlightLog() {
  ensureCurrentFlightLogCaptured();

  const entry = currentFlightLogEntry.value;
  if (entry) {
    selectedEntryId.value = entry.id;
  }
}

function selectEntry(id) {
  selectedEntryId.value = id;
  confirmDeleteId.value = null;
}

function deleteEntry(id) {
  tuningLogStore.deleteEntry(id);
  confirmDeleteId.value = null;
  if (selectedEntryId.value === id) {
    selectedEntryId.value = null;
  }
}

const displayOrder = computed(() => {
  const order = pinnedSlotVisible.value ? [null] : [];
  for (let i = tuningLogStore.entries.length - 1; i >= 0; i--) {
    order.push(tuningLogStore.entries[i].id);
  }
  return order;
});

function step(dir) {
  if (!tuningLogStore.hasLog) return;

  const order = displayOrder.value;
  const pos = order.indexOf(selectedEntryId.value);
  const newPos = pos + dir;
  if (newPos < 0 || newPos >= order.length) return;

  selectEntry(order[newPos]);
}

watch(open, (isOpen) => {
  createError.value = "";
  importError.value = "";
  aiError.value = "";
  confirmDeleteId.value = null;

  if (!isOpen) return;

  if (tuningLogStore.hasLog) {
    syncSelectionToCurrentFlightLog();
  } else {
    selectedEntryId.value = null;
  }
});

// ---- Sidebar badge helpers ----

function entryCost(entry) {
  return (entry.ai && entry.ai.costUsd) || 0;
}

function entryHasAnalysis(entry) {
  return !!(entry.ai && entry.ai.conversation && entry.ai.conversation.length);
}

// The current entry isn't necessarily the newest one in the log - entries are ordered by when
// they were captured, not by flight log timestamp, so an older flight log opened later ends up
// above it in the list.
function isBehindLatest(entry) {
  const entries = tuningLogStore.entries;
  const latestId = entries.length ? entries[entries.length - 1].id : null;
  return entry.id === currentFlightLogEntryId.value && entry.id !== latestId;
}

// A tuning log is meant to track one craft's tuning over time - flag an entry whose own recorded
// craft name (from whatever flight log was open when it was captured) doesn't match the craft
// this tuning log was created for, so switching flight logs by mistake doesn't quietly mix data
// from two different craft into the same history.
function entryCraftMismatch(entry) {
  const logCraftName = tuningLogStore.currentLog?.craftName;
  if (!entry.craftName || !logCraftName) return false;
  return entry.craftName.trim().toLowerCase() !== logCraftName.trim().toLowerCase();
}

// ---- Main panel ----

const hasImage = computed(() => !!currentEntry.value?.image);
const hasConfig = computed(() => !!currentEntry.value?.config);

const mainTitle = computed(() => {
  if (selectedEntryId.value === null) return "Current flight log";
  if (isCurrentFlightLog.value) return `Current flight log — ${formatTimestamp(currentEntry.value.timestamp)}`;
  return formatTimestamp(currentEntry.value.timestamp);
});

const noImageMessage = computed(() =>
  logStore.flightLog ? "The step response panel is not available for this flight log." : "No flight log is currently open.",
);

// Past entries are read-only, so there's no point showing an empty notes box for them - only hide
// it when there's nothing to read. The current entry always shows it, since that's where the user
// would type new notes in.
const showNotes = computed(() => !!currentEntry.value && (isCurrentFlightLog.value || !!currentEntry.value.notes));

const notesDraft = ref("");
watch(
  currentEntry,
  (entry) => {
    notesDraft.value = entry?.notes || "";
  },
  { immediate: true },
);

function onNotesBlur() {
  if (currentEntry.value && isCurrentFlightLog.value) {
    tuningLogStore.updateEntryNotes(currentEntry.value.id, notesDraft.value);
  }
}

async function onCopyImage() {
  if (!currentEntry.value?.image) return;

  try {
    const res = await fetch(currentEntry.value.image);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  } catch (e) {
    aiError.value = `Could not copy the image: ${e.message}`;
  }
}

async function onCopyPrompt() {
  if (!currentEntry.value) return;

  const text = TuningAI.buildPromptText({
    configSummary: currentEntry.value.config,
    instructions: aiPromptText.value,
    expertMode: expertModeModel.value,
  });

  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    aiError.value = `Could not copy: ${e.message}`;
  }
}

// ---- Ask AI ----

const aiPromptText = ref("");
const aiError = ref("");
const pendingEntryIds = ref(new Set());
const streamingTextByEntryId = ref({});

const modelModel = computed({
  get: () => settingsStore.userSettings.aiModel || AI_MODELS.defaultModel,
  set: (val) => settingsStore.saveSetting("aiModel", val),
});

const expertModeModel = computed({
  get: () => tuningLogStore.aiExpertMode,
  set: (val) => tuningLogStore.setAiExpertMode(val),
});

const hasConversation = computed(() => !!currentEntry.value?.ai?.conversation?.length);
// Keyed by entry id (not just the currently-viewed entry) so the "Thinking…" state survives
// switching to another entry and back.
const isPending = computed(() => !!(currentEntry.value && pendingEntryIds.value.has(currentEntry.value.id)));
// Asking is only offered on the entry for the currently open flight log - it doesn't make sense
// to start a new AI conversation about a past entry. A past conversation is still shown
// (read-only) if that entry already has one.
const canAsk = computed(() => hasImage.value && isCurrentFlightLog.value);
const hasApiKey = computed(() => !!settingsStore.userSettings.aiApiKey);

const showAskInput = computed(() => canAsk.value && hasApiKey.value);
const showNoApiKeyBanner = computed(() => canAsk.value && !hasApiKey.value && !tuningLogStore.apiKeyBannerDismissed);
// Once the no-API-key banner has been dismissed on an entry with no conversation yet and no
// request in flight, there'd be nothing left under the "PID tuning advice" heading (no banner, no
// ask form, no conversation) - collapse the whole panel rather than leave an empty header showing.
const showAiPanel = computed(
  () => hasImage.value && (hasConversation.value || isPending.value || (isCurrentFlightLog.value && (hasApiKey.value || !tuningLogStore.apiKeyBannerDismissed))),
);

const conversationTurns = computed(() => {
  const conversation = currentEntry.value?.ai?.conversation || [];
  // Only string-content turns are shown - a 'user' turn with array content is the initial
  // image+prompt message, already shown above via the image/config panels.
  return conversation.filter((turn) => typeof turn.content === "string");
});

const streamingText = computed(() => {
  const entry = currentEntry.value;
  return entry ? streamingTextByEntryId.value[entry.id] : null;
});

function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(String(text ?? "")));
}

function onAskAi() {
  const entry = currentEntry.value;
  if (!entry || !entry.image) return;

  const settings = settingsStore.userSettings;
  const promptText = aiPromptText.value;
  const hadConversation = hasConversation.value;
  const historyMessages = TuningAI.buildHistoryMessages(tuningLogStore.currentLog, entry.id);

  pendingEntryIds.value = new Set(pendingEntryIds.value).add(entry.id);
  aiError.value = "";

  function setStreamingText(entryId, text) {
    streamingTextByEntryId.value = { ...streamingTextByEntryId.value, [entryId]: text };
  }

  function clearPending(entryId) {
    const nextPending = new Set(pendingEntryIds.value);
    nextPending.delete(entryId);
    pendingEntryIds.value = nextPending;

    const nextStreaming = { ...streamingTextByEntryId.value };
    delete nextStreaming[entryId];
    streamingTextByEntryId.value = nextStreaming;
  }

  const callOptions = {
    apiKey: settings.aiApiKey,
    model: settings.aiModel,
    effort: settings.aiEffort,
    skillId: settings.aiSkillId,
    historyMessages,
    expertMode: expertModeModel.value,
    onChunk: (textSnapshot) => setStreamingText(entry.id, textSnapshot),
  };

  function onResult(text, entryMessages, costUsd) {
    clearPending(entry.id);
    tuningLogStore.setEntryAiResult(entry.id, { model: settings.aiModel, conversation: entryMessages, costUsd });

    // aiPromptText is a single shared textarea, not per-entry - only worth clearing it if we're
    // still looking at the entry this response belongs to.
    if (currentEntry.value?.id === entry.id) {
      aiPromptText.value = "";
    }
  }

  function onError(message) {
    clearPending(entry.id);

    // Only worth surfacing the error inline if we're still looking at the entry it belongs to -
    // if the user has since switched entries, the pending indicator just quietly clears.
    if (currentEntry.value?.id === entry.id) {
      aiError.value = message;
    }
  }

  if (hadConversation) {
    callOptions.messages = entry.ai.conversation;
    callOptions.question = promptText;
    TuningAI.ask(callOptions, onResult, onError);
  } else {
    callOptions.entry = entry;
    callOptions.instructions = promptText;
    TuningAI.analyze(callOptions, onResult, onError);
  }
}

// ---- Formatting ----

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

// Compares using UTC getters - see formatTimestamp for why.
function isSameDay(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

/**
 * Entry timestamps are the flight log's own recorded start time (see tuning_log.js:logTimestamp),
 * always stamped in UTC. We want the digits shown here to match the "Log start datetime" the user
 * sees elsewhere (e.g. the header dialog) verbatim, rather than shifting them to the viewer's
 * local timezone - so this reads UTC components throughout instead of local ones.
 */
function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;

    const now = new Date();
    if (isSameDay(d, now)) return `Today ${time}`;

    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    if (isSameDay(d, yesterday)) return `Yesterday ${time}`;

    return `${pad2(d.getUTCDate())} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()} ${time}`;
  } catch {
    return iso;
  }
}

function formatCost(usd) {
  if (!usd) return "";
  return `$${usd.toFixed(usd < 1 ? 4 : 2)}`;
}
</script>
