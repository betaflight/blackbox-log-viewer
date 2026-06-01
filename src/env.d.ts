/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Single-file components — typed as generic Vue components until each gains `lang="ts"`.
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

// Third-party modules without bundled type declarations.
declare module "sortablejs";
declare module "throttle-debounce";

// Injected by Vite `define` (see vite.config.js).
declare const __APP_VERSION__: string;

// Globals loaded via <script> tags (vendored libraries) and platform APIs.
declare const THREE: unknown; // vendored three.min.js (r70)
declare const L: unknown; // Leaflet
declare const chrome: unknown; // Chrome/Electron extension APIs (pref_storage.js)
