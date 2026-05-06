<template>
  <!-- Reopen button when legend is hidden -->
  <span
    v-show="!graphStore.legendVisible"
    class="absolute right-2.5 top-2 z-5 cursor-pointer opacity-60 hover:opacity-100 transition-opacity text-[var(--text-secondary)]"
    title="Show the legend"
    @click="showLegend"
  >
    <UIcon name="i-lucide-settings" class="size-4" />
  </span>

  <!-- Legend sidebar -->
  <div v-show="graphStore.legendVisible" class="log-graph-config">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-lg font-semibold m-0">{{ graphStore.legendTitle }}</h2>
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-x"
        size="2xs"
        title="Hide the legend"
        @click="hideLegend"
      />
    </div>

    <div v-if="logStore.logIndexEntries.length > 1" class="mb-2">
      <USelect
        :model-value="logStore.activeLogIndex"
        :items="logStore.logIndexEntries"
        size="xs"
        class="w-full"
        @update:model-value="onLogIndexChange"
      />
    </div>
    <div v-else-if="logStore.logIndexEntries.length === 1" class="text-xs text-[var(--text-secondary)] mb-2">
      {{ logStore.logIndexEntries[0].label }}
    </div>

    <div ref="legendContainer" class="log-graph-legend">
      <div
        v-for="(graph, gi) in graphStore.legendGraphs"
        :key="gi"
        class="graph-legend"
        :data-index="gi"
        draggable="true"
        @dragstart="onDragStart($event, gi)"
        @dragend="onDragEnd"
      >
        <h3
          class="graph-legend-group"
          @click="onGraphClick($event, gi)"
        >
          <UIcon name="i-lucide-trash-2" class="size-3.5 mr-1 inline-block align-middle" />
          {{ graph.label }}
        </h3>

        <ul class="list-none pl-0 graph-legend-field-list">
          <li
            v-for="(field, fi) in graph.fields"
            :key="fi"
            class="graph-legend-field"
            :class="{ highlight: highlightGi === gi && highlightFi === fi }"
            @mouseenter="onFieldHover(gi, fi)"
            @mouseleave="onFieldLeave"
          >
            <span
              class="graph-legend-field-name"
              @click="onFieldClick($event, gi, fi, field)"
            >{{ field.friendlyName }}</span>
            <span
              class="graph-legend-field-visibility"
              :class="field.hidden ? 'legend-eye-closed' : 'legend-eye-open'"
              @click.prevent="onToggleVisibility(gi, fi)"
            >
              <UIcon
                :name="field.hidden ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                class="size-3.5"
              />
            </span>
            <span
              class="graph-legend-field-value"
              @click="onFieldClick($event, gi, fi, field)"
            >{{ legendValues[field.name]?.value ?? '' }}</span>
            <div
              class="graph-legend-field-settings"
              :style="{ background: field.color }"
              @click="onFieldClick($event, gi, fi, field)"
            >{{ legendValues[field.name]?.settings ?? '' }}</div>
          </li>
        </ul>
      </div>
    </div>

    <fieldset class="flex gap-1 override-button-group my-2">
      <UButton variant="ghost" color="neutral" size="xs" title="Expo On/Off" @click="toggleExpo">
        <svg width="20" height="20" viewBox="0 0 8.467 8.467">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width=".5" d="M0 4.233s2.117 5.292 4.233 0c2.117-5.291 4.234 0 4.234 0"/>
          <path fill="currentColor" d="M4.233 0L3.175 1.058h2.117L4.233 0zm0 1.058L3.175 2.117h.794V6.35h-.794l1.058 1.058L5.292 6.35h-.794V2.117h.794L4.233 1.058zm0 6.35H3.175l1.058 1.059 1.059-1.059H4.233z"/>
        </svg>
      </UButton>
      <UButton variant="ghost" color="neutral" size="xs" title="Smoothing On/Off" @click="toggleSmoothing">
        <svg width="20" height="20" viewBox="0 0 8.467 8.467">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width=".5" d="M0 4.233s2.117 5.292 4.233 0c2.117-5.291 4.234 0 4.234 0"/>
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=".265"
            d="M0 4.233l1.058 3.97 1.059-2.911 1.058 2.91 1.058-7.144 1.059 4.234L6.35.265l1.058 3.968h1.059"/>
        </svg>
      </UButton>
      <UButton variant="ghost" color="neutral" size="xs" title="Grid On/Off" @click="toggleGrid">
        <svg width="20" height="20" viewBox="0 0 8.467 8.467">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width=".5" d="M0 4.233s2.117 5.292 4.233 0c2.117-5.291 4.234 0 4.234 0"/>
          <g fill="none" stroke="currentColor" stroke-width=".198">
            <path d="M0 3.175h8.467M0 7.408h8.467M0 5.292h8.467M0 1.058h8.467" opacity=".75"/>
          </g>
        </svg>
      </UButton>
    </fieldset>

    <UButton
      color="primary"
      variant="solid"
      block
      size="xs"
      class="text-black"
      label="Graph setup"
      @click="openGraphConfig"
    />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useGraphStore } from "../stores/graph.js";
import { useAppStore } from "../stores/app.js";
import { useLogStore } from "../stores/log.js";

const graphStore = useGraphStore();
const appStore = useAppStore();
const logStore = useLogStore();
const legendContainer = ref(null);

const legendValues = computed(() => graphStore.legendValues);

// --- Highlight ---
const highlightGi = ref(null);
const highlightFi = ref(null);

function onFieldHover(gi, fi) {
  highlightGi.value = gi;
  highlightFi.value = fi;
  appStore.controller?.legendHighlight?.(gi, fi);
}

function onFieldLeave() {
  highlightGi.value = null;
  highlightFi.value = null;
  appStore.controller?.legendHighlight?.(null, null);
}

// --- Field click → analyser selection ---
function onFieldClick(e, gi, fi, field) {
  if (e.button !== 0 || e.altKey) return;
  appStore.controller?.legendSelect?.(gi, fi, field.friendlyName, e.ctrlKey);
  e.preventDefault();
}

// --- Graph title click → zoom/expand ---
function onGraphClick(e, gi) {
  if (e.button !== 0) return;
  if (e.altKey) {
    appStore.controller?.legendExpand?.(gi);
  } else {
    appStore.controller?.legendZoom?.(gi);
  }
  e.preventDefault();
}

// --- Visibility toggle ---
function onToggleVisibility(gi, fi) {
  appStore.controller?.legendToggleField?.(gi, fi);
}

// --- Show/Hide ---
function showLegend() {
  graphStore.legendVisible = true;
  appStore.controller?.legendVisibilityChange?.(false);
}

function hideLegend() {
  graphStore.legendVisible = false;
  appStore.controller?.legendVisibilityChange?.(true);
}

// --- Drag & drop for graph reorder ---
let dragIndex = null;

function onDragStart(e, gi) {
  dragIndex = gi;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(gi));
  e.target.classList.add("dragging");
}

function onDragEnd(e) {
  e.target.classList.remove("dragging");
  dragIndex = null;
}

// Dragover/drop on the container
function setupDragContainer(el) {
  if (!el) return;
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = el.querySelector(".dragging");
    if (!dragging) return;
    const afterElement = getDragAfterElement(el, e.clientY);
    if (!afterElement) {
      el.appendChild(dragging);
    } else {
      afterElement.before(dragging);
    }
  });
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    const newOrder = Array.from(el.querySelectorAll(".graph-legend"))
      .map((div) => Number.parseInt(div.dataset.index));
    appStore.controller?.legendReorder?.(newOrder);
  });
}

function getDragAfterElement(container, y) {
  const draggables = [...container.querySelectorAll(".graph-legend:not(.dragging)")];
  return draggables.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}

// Setup dragover/drop when container is mounted
import { watch, nextTick } from "vue";
watch(legendContainer, (el) => {
  if (el) setupDragContainer(el);
});

// --- Override toggles ---
function toggleExpo() {
  appStore.controller?.toggleExpo?.();
}

function toggleSmoothing() {
  appStore.controller?.toggleSmoothing?.();
}

function toggleGrid() {
  appStore.controller?.toggleGrid?.();
}

function openGraphConfig() {
  appStore.graphConfigDialogOpen = true;
}

function onLogIndexChange(val) {
  appStore.controller?.selectLogIndex?.(val);
}
</script>
