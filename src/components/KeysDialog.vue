<template>
  <UModal v-model:open="open" :ui="{ width: 'max-w-3xl' }">
    <template #header>
      <h4 class="font-semibold">Keyboard Shortcuts</h4>
    </template>

    <template #body>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
        <div class="flex flex-col gap-4">
          <ShortcutSection title="Scrolling, Zooming, Play and Pause">
            <ShortcutItem :keys="['Home', 'End']" join="and" description="Go to the start or end of the current log." />
            <ShortcutItem :keys="['←', '→']" join="and" description="Move through log by 100ms." />
            <ShortcutItem :keys="['Alt', '←', '→']" join="" description="Move by exactly one frame." />
            <ShortcutItem :keys="['PgUp', 'PgDn']" join="and" description="Move through log fast." />
            <ShortcutItem :keys="['Shift', '←', '→']" join="" description="Zoom log out and in." />
            <ShortcutItem :keys="['Shift', 'Alt', '←', '→']" join="" description="Zoom log out and in faster." />
            <ShortcutItem :keys="['Space']" description="Play / Pause log and video." />
          </ShortcutSection>

          <ShortcutSection title="Quick Modes">
            <ShortcutItem :keys="['Z']" description="Toggle QuickZoom — zoom out to max and back." />
            <ShortcutItem :keys="['S']" description="Toggle QuickSmooth — force all smoothing to zero." />
            <ShortcutItem :keys="['X']" description="Toggle QuickExpo — force all expo to linear." />
            <ShortcutItem :keys="['G']" description="Toggle QuickGrid — hide all grids." />
            <ShortcutItem :keys="['T']" description="Toggle field values table." />
            <ShortcutItem :keys="['C']" description="Toggle configuration dump (if loaded)." />
          </ShortcutSection>

          <ShortcutSection title="Analyser">
            <ShortcutItem :keys="['A']" description="Toggle analyser display." />
            <ShortcutItem :keys="['Shift']" description="Show frequency under mouse." />
          </ShortcutSection>
        </div>

        <div class="flex flex-col gap-4">
          <ShortcutSection title="Marking and Smart Sync">
            <ShortcutItem :keys="['M']" description="Toggle marker at current time. Offset is shown in the status bar." />
            <ShortcutItem :keys="['Alt', 'M']" description="Smart Sync — sync log and video at marker position." />
            <ShortcutItem :keys="['I']" description="Mark the start of (IN) video export or analyser start." />
            <ShortcutItem :keys="['O']" description="Mark the end of (OUT) video export or analyser end." />
          </ShortcutSection>

          <ShortcutSection title="Workspaces / Favourites">
            <ShortcutItem :keys="['Shift', '0-9', 'S']" description="Save current graph config to workspace 0–9, or Shift-S to save to current workspace." />
            <ShortcutItem :keys="['0-9']" description="Recall workspace/favourite stored in keys 0–9." />
            <ShortcutItem :keys="['Shift', 'W']" description="Show menu to load default workspace." />
            <ShortcutItem :keys="['Ctrl', 'Z']" description="Toggle between last two graph configurations." />
          </ShortcutSection>

          <ShortcutSection title="Bookmarks">
            <ShortcutItem :keys="['Alt', 'Shift', '1-9']" description="Save current time to bookmark 1–9." />
            <ShortcutItem :keys="['Alt', '1-9']" description="Recall bookmark 1–9." />
            <ShortcutItem :keys="['Alt', '0']" description="Clear all bookmarks." />
            <ShortcutItem :keys="['Alt', 'S']" description="Save current graph to PNG file." />
          </ShortcutSection>

          <ShortcutSection title="Quick Field Adjustments">
            <ShortcutItem :keys="['Ctrl', 'Scroll']" description="Adjust smoothing of field by hovering in legend and scroll." />
            <ShortcutItem :keys="['Shift', 'Scroll']" description="Adjust zoom of field by hovering in legend and scroll." />
            <ShortcutItem :keys="['Alt', 'Scroll']" description="Adjust expo of field by hovering in legend and scroll." />
          </ShortcutSection>
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
import { h } from "vue";

const open = defineModel("open", { type: Boolean, default: false });

const ShortcutSection = (props, { slots }) =>
  h("div", [
    h("h5", { class: "font-semibold text-sm mb-2 text-neutral-500 dark:text-neutral-400 uppercase tracking-wide" }, props.title),
    h("ul", { class: "flex flex-col gap-1.5" }, slots.default?.()),
  ]);
ShortcutSection.props = ["title"];

const ShortcutItem = (props) =>
  h("li", { class: "flex items-start gap-3" }, [
    h("span", { class: "flex items-center gap-1 shrink-0 min-w-28" },
      props.keys.flatMap((key, i) => {
        const items = [
          h("kbd", { class: "px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-xs font-mono" }, key),
        ];
        if (props.join && i < props.keys.length - 1) {
          items.push(h("span", { class: "text-xs text-neutral-400" }, props.join));
        }
        return items;
      }),
    ),
    h("span", { class: "text-sm" }, props.description),
  ]);
ShortcutItem.props = ["keys", "join", "description"];
</script>
