<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-[95vw] lg:max-w-[1800px]' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-keyboard" class="size-5 text-primary" />
        <h4 class="font-semibold">Keyboard Shortcuts</h4>
      </div>
    </template>

    <template #body>
      <div class="keys-grid">
        <!-- Column 1 -->
        <div class="keys-col">
          <div class="keys-card">
            <div class="keys-card-header">
              <UIcon name="i-lucide-move" class="size-3.5 text-primary" />
              <span>Navigation</span>
            </div>
            <table class="keys-table">
              <tr><td class="keys-td-keys"><kbd>←</kbd> <kbd>→</kbd></td><td>Move through log by 100ms</td></tr>
              <tr><td class="keys-td-keys"><kbd>Alt</kbd> <kbd>←</kbd> <kbd>→</kbd></td><td>Move by exactly one frame</td></tr>
              <tr><td class="keys-td-keys"><kbd>PgUp</kbd> <kbd>PgDn</kbd></td><td>Move through log fast</td></tr>
              <tr><td class="keys-td-keys"><kbd>Home</kbd> <kbd>End</kbd></td><td>Jump to start / end of log</td></tr>
              <tr><td class="keys-td-keys"><kbd>Shift</kbd> <kbd>←</kbd> <kbd>→</kbd></td><td>Zoom in / out</td></tr>
              <tr><td class="keys-td-keys"><kbd>Shift</kbd> <kbd>Alt</kbd> <kbd>←</kbd> <kbd>→</kbd></td><td>Zoom in / out faster</td></tr>
              <tr><td class="keys-td-keys"><kbd>Space</kbd></td><td>Play / Pause</td></tr>
            </table>
          </div>

          <div class="keys-card">
            <div class="keys-card-header">
              <UIcon name="i-lucide-activity" class="size-3.5 text-primary" />
              <span>Spectrum Analyser</span>
            </div>
            <table class="keys-table">
              <tr><td class="keys-td-keys"><kbd>A</kbd></td><td>Toggle analyser display</td></tr>
              <tr><td class="keys-td-keys"><kbd>Shift</kbd></td><td>Show frequency under mouse</td></tr>
            </table>
          </div>
        </div>

        <!-- Column 2 -->
        <div class="keys-col">
          <div class="keys-card">
            <div class="keys-card-header">
              <UIcon name="i-lucide-zap" class="size-3.5 text-primary" />
              <span>Quick Modes</span>
            </div>
            <table class="keys-table">
              <tr><td class="keys-td-keys"><kbd>Z</kbd></td><td>QuickZoom — max zoom and back</td></tr>
              <tr><td class="keys-td-keys"><kbd>S</kbd></td><td>QuickSmooth — smoothing to zero</td></tr>
              <tr><td class="keys-td-keys"><kbd>X</kbd></td><td>QuickExpo — expo to linear</td></tr>
              <tr><td class="keys-td-keys"><kbd>G</kbd></td><td>QuickGrid — hide all grids</td></tr>
              <tr><td class="keys-td-keys"><kbd>T</kbd></td><td>Toggle field values table</td></tr>
              <tr><td class="keys-td-keys"><kbd>C</kbd></td><td>Toggle configuration dump</td></tr>
            </table>
          </div>

          <div class="keys-card">
            <div class="keys-card-header">
              <UIcon name="i-lucide-sliders-horizontal" class="size-3.5 text-primary" />
              <span>Field Adjustments</span>
            </div>
            <table class="keys-table">
              <tr><td class="keys-td-keys"><kbd>Ctrl</kbd> <kbd>Scroll</kbd></td><td>Adjust smoothing</td></tr>
              <tr><td class="keys-td-keys"><kbd>Shift</kbd> <kbd>Scroll</kbd></td><td>Adjust zoom</td></tr>
              <tr><td class="keys-td-keys"><kbd>Alt</kbd> <kbd>Scroll</kbd></td><td>Adjust expo</td></tr>
            </table>
            <p class="keys-hint">Hover over a field in the legend, then scroll</p>
          </div>
        </div>

        <!-- Column 3 -->
        <div class="keys-col">
          <div class="keys-card">
            <div class="keys-card-header">
              <UIcon name="i-lucide-crosshair" class="size-3.5 text-primary" />
              <span>Marking &amp; Sync</span>
            </div>
            <table class="keys-table">
              <tr><td class="keys-td-keys"><kbd>M</kbd></td><td>Toggle marker at current time</td></tr>
              <tr><td class="keys-td-keys"><kbd>Alt</kbd> <kbd>M</kbd></td><td>Smart Sync at marker position</td></tr>
              <tr><td class="keys-td-keys"><kbd>I</kbd></td><td>Set IN point</td></tr>
              <tr><td class="keys-td-keys"><kbd>O</kbd></td><td>Set OUT point</td></tr>
            </table>
          </div>

          <div class="keys-card">
            <div class="keys-card-header">
              <UIcon name="i-lucide-bookmark" class="size-3.5 text-primary" />
              <span>Bookmarks</span>
            </div>
            <table class="keys-table">
              <tr><td class="keys-td-keys"><kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>1-9</kbd></td><td>Save bookmark</td></tr>
              <tr><td class="keys-td-keys"><kbd>Alt</kbd> <kbd>1-9</kbd></td><td>Recall bookmark</td></tr>
              <tr><td class="keys-td-keys"><kbd>Alt</kbd> <kbd>0</kbd></td><td>Clear all bookmarks</td></tr>
              <tr><td class="keys-td-keys"><kbd>Alt</kbd> <kbd>S</kbd></td><td>Save graph to PNG</td></tr>
            </table>
          </div>
        </div>

        <!-- Column 4 -->
        <div class="keys-col">
          <div class="keys-card">
            <div class="keys-card-header">
              <UIcon name="i-lucide-layout-grid" class="size-3.5 text-primary" />
              <span>Workspaces</span>
            </div>
            <table class="keys-table">
              <tr><td class="keys-td-keys"><kbd>0-9</kbd></td><td>Recall workspace</td></tr>
              <tr><td class="keys-td-keys"><kbd>Shift</kbd> <kbd>0-9</kbd></td><td>Save to workspace</td></tr>
              <tr><td class="keys-td-keys"><kbd>Shift</kbd> <kbd>S</kbd></td><td>Save to current workspace</td></tr>
              <tr><td class="keys-td-keys"><kbd>Shift</kbd> <kbd>W</kbd></td><td>Load default workspace</td></tr>
              <tr><td class="keys-td-keys"><kbd>Ctrl</kbd> <kbd>Z</kbd></td><td>Toggle last two configs</td></tr>
            </table>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        variant="soft"
        color="neutral"
        label="Close"
        size="sm"
        @click="open = false"
      />
    </template>
  </UModal>
</template>

<script setup>
const open = defineModel("open", { type: Boolean, default: false });
</script>

<style scoped>
.keys-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding: 0.75rem;
}

@media (max-width: 900px) {
  .keys-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.keys-col {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.keys-card {
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--ui-bg-elevated);
}

.keys-card-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-highlighted);
  margin-bottom: 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--ui-border);
}

.keys-table {
  width: 100%;
  border-collapse: collapse;
}

.keys-table td {
  padding: 0.2rem 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  vertical-align: baseline;
}

.keys-td-keys {
  white-space: nowrap;
  padding-right: 0.75rem !important;
  width: 1%;
}

.keys-table kbd {
  display: inline-block;
  padding: 0.05rem 0.35rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.65rem;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-bottom-width: 2px;
  border-radius: 0.25rem;
}

.keys-hint {
  margin: 0.35rem 0 0;
  font-size: 0.62rem;
  color: var(--text-dimmed);
  font-style: italic;
}
</style>
