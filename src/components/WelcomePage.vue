<template>
  <div v-if="!logStore.hasLog" class="welcome-page">
    <!-- Hero -->
    <div class="hero">
      <img src="/images/light-wide-2.svg" alt="Betaflight" class="hero-logo" />
      <p class="hero-subtitle">Blackbox Explorer</p>
      <p class="hero-tagline">Analyze flight logs recorded by Betaflight's Blackbox feature</p>
      <LogFileInput size="lg" label="Open log file / video" @files-selected="$emit('files-selected', $event)" />
    </div>

    <!-- Info grid -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-header">
          <UIcon name="i-lucide-book-open" class="size-4 text-primary-500" />
          <h3>Getting Started</h3>
        </div>
        <p>
          Blackbox is built in to
          <a href="https://github.com/betaflight/betaflight/releases" target="_blank" rel="noopener noreferrer">Betaflight</a>
          and supported on most flight controllers.
        </p>
        <div class="info-links">
          <a href="https://github.com/betaflight/betaflight/blob/master/docs/Blackbox.md" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-file-text" class="size-3.5" /> Recording docs
          </a>
          <a href="https://github.com/betaflight/blackbox-tools/blob/master/Readme.md" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-monitor" class="size-3.5" /> Viewer docs
          </a>
          <a href="https://github.com/betaflight/blackbox-log-viewer/issues" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-bug" class="size-3.5" /> Report a bug
          </a>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header">
          <UIcon name="i-lucide-sliders-horizontal" class="size-4 text-primary-500" />
          <h3>Tuning Resources</h3>
        </div>
        <p>Use Blackbox insights to tune PIDs and filter settings.</p>
        <div class="info-links">
          <a href="https://github.com/betaflight/betaflight/blob/master/docs/PID-Tuning.md" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-file-text" class="size-3.5" /> PID tuning docs
          </a>
          <a href="http://www.rcgroups.com/forums/showthread.php?t=2439428" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-graduation-cap" class="size-3.5" /> PID guide — J. Bardwell
          </a>
          <a href="http://www.rcgroups.com/forums/showthread.php?t=2386267" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-message-circle" class="size-3.5" /> Log analysis — RCGroups
          </a>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header">
          <UIcon name="i-lucide-wrench" class="size-4 text-primary-500" />
          <h3>Tools</h3>
        </div>
        <p>Convert and export your logs for further analysis.</p>
        <div class="info-links">
          <a href="https://github.com/betaflight/blackbox-tools/" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-terminal" class="size-3.5" /> blackbox_decode — CSV export
          </a>
          <a href="https://github.com/betaflight/blackbox-tools/" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-film" class="size-3.5" /> blackbox_render — PNG frames
          </a>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header">
          <UIcon name="i-lucide-info" class="size-4 text-primary-500" />
          <h3>Links</h3>
        </div>
        <div class="info-links">
          <a href="https://blackbox.betaflight.com" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-globe" class="size-3.5" /> Latest release
          </a>
          <a href="https://master.blackbox.betaflight.com/" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-git-branch" class="size-3.5" /> Development build
          </a>
          <a href="https://github.com/betaflight/blackbox-log-viewer" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-github" class="size-3.5" /> Source on GitHub
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useLogStore } from "../stores/log.js";
import LogFileInput from "./LogFileInput.vue";

defineEmits(["files-selected"]);
const logStore = useLogStore();
</script>

<style scoped>
.welcome-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 60vh;
  gap: 2rem;
  padding: 2.5rem 1.5rem 1.5rem;
}

/* Hero section */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.25rem;
}

.hero-logo {
  width: min(360px, 80vw);
  margin-bottom: 0.25rem;
  filter: brightness(0) invert(0);
}

:root.dark .hero-logo {
  filter: brightness(0) invert(1);
}

.hero-subtitle {
  font-size: 1.1rem;
  font-weight: 300;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-primary-500);
  margin: 0;
}

.hero-tagline {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 0.75rem;
}

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  width: 100%;
  max-width: 56rem;
}

@media (max-width: 900px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

/* Info cards */
.info-card {
  border: 1px solid var(--border-color, #ddd);
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--surface-0);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  transition: border-color 0.2s;
}

.info-card:hover {
  border-color: var(--color-primary-500);
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.info-card-header h3 {
  font-size: 0.8rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.info-card p {
  margin: 0;
  line-height: 1.4;
}

/* Link list */
.info-links {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: auto;
  padding-top: 0.25rem;
  border-top: 1px solid var(--border-color, #eee);
}

.info-links a {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  color: var(--color-primary-700, #bb6502);
  text-decoration: none;
  padding: 0.2rem 0.35rem;
  border-radius: 0.25rem;
  transition: background-color 0.15s, color 0.15s;
}

.info-links a:hover {
  background-color: var(--color-primary-50, #fffeea);
  color: var(--color-primary-800, #964f00);
}

:root.dark .info-links a {
  color: var(--color-primary-400, #ffd03d);
}

:root.dark .info-links a:hover {
  background-color: rgba(255, 187, 0, 0.1);
  color: var(--color-primary-300, #ffe066);
}
</style>
