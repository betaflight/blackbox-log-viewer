<template>
  <div v-if="!logStore.hasLog" class="welcome-page">
    <!-- Hero -->
    <div class="hero">
      <img :src="logoSrc" alt="Rotorflight" class="hero-logo" />
      <p class="hero-subtitle">Blackbox Explorer</p>
      <p class="hero-tagline">Analyze flight logs recorded by Rotorflights's Blackbox feature.</p>      
      <p class="tag-version">{{ appStore.statusViewerVersion }}</p>
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
          <a href="https://github.com/rotorflight/rotorflight/releases" target="_blank"
            rel="noopener noreferrer">Rotorflight</a>
          and supported on most flight controllers.
        </p>
        <div class="info-links">
          <a href="https://rotorflight.org/docs/examples" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-file-text" class="size-3.5" /> Getting started
          </a>
          <a href="https://www.rcgroups.com/forums/showthread.php?4000345-Rotorflight-Flight-Control-%28FBL%29-Software-Official-discussion"
            target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-file-text" class="size-3.5" /> RC Groups
          </a>
          <a href="https://discord.gg/6QUySXdEvd" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-monitor" class="size-3.5" /> Discord
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
          <a href="https://rotorflight.org/docs/Tuning/First-Flight-Filter-Tuning" target="_blank"
            rel="noopener noreferrer">
            <UIcon name="i-lucide-file-text" class="size-3.5" /> Filter Tuning
          </a>

        </div>
      </div>


      <div class="info-card">
        <div class="info-card-header">
          <UIcon name="i-lucide-info" class="size-4 text-primary-500" />
          <h3>Links</h3>
        </div>
        <div class="info-links">
          <a href="https://www.rotorflight.org" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-globe" class="size-3.5" /> Rotorflight
          </a>          
          <a href="https://github.com/bph838/blackbox-log-viewer" target="_blank" rel="noopener noreferrer">
            <UIcon name="i-lucide-github" class="size-3.5" /> Source on GitHub
          </a>
        </div>
      </div>
    </div>

    <!-- Footer info-->
     <div class="footer">
     <p><strong>Note:</strong> this isn't the official Rotorflight Blackbox viewer, it's a fork from the latest Betaflight Blackbox Viewer.</p>
     </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useLogStore } from "../stores/log.js";
import { useAppStore } from "../stores/app.js";
import LogFileInput from "./LogFileInput.vue";

defineEmits(["files-selected"]);
const logStore = useLogStore();
const appStore = useAppStore();

// rf_logo_white.svg/rf_logo_black.svg each have the "ROTOR" wordmark's blue baked in already -
// pick whichever reads correctly against the current background instead of CSS-filtering a
// single source file flat, which was wiping out that blue along with everything else.
const logoSrc = computed(() =>
  appStore.darkThemeEnabled ? "/images/rf_logo_white.svg" : "/images/rf_logo_black.svg",
);
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


.footer{
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.25rem;
}

.footer p{
   font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.6;
  margin: -0.5rem 0 0.75rem;
}

.hero-logo {
  width: min(360px, 80vw);
  margin-bottom: 0.25rem;
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

.tag-version {
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.6;
  margin: -0.5rem 0 0.75rem;
}

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
  /*margin-top: auto;*/
  padding-top: 0.25rem;
  border-top: 1px solid var(--border-color, #eee);
}

.info-links a {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  color: var(--color-primary-700, #063363);
  text-decoration: none;
  padding: 0.2rem 0.35rem;
  border-radius: 0.25rem;
  transition: background-color 0.15s, color 0.15s;
}

.info-links a:hover {
  background-color: var(--color-primary-50, #eaf4fb);
  color: var(--color-primary-800, #052a4f);
}

:root.dark .info-links a {
  color: var(--color-primary-400, #2f8ed0);
}

:root.dark .info-links a:hover {
  background-color: rgba(8, 80, 172, 0.1);
  color: var(--color-primary-300, #63b0e3);
}
</style>
