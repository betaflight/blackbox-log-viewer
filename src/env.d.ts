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
declare module "webm-writer";

// Injected by Vite `define` (see vite.config.js).
declare const __APP_VERSION__: string;

// Globals loaded via <script> tags (vendored libraries) and platform APIs.
// three.js (vendored r70 via <script>), no bundled types; rich untyped API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const THREE: any;
// Leaflet — loaded via <script>, no bundled types; used as a rich untyped API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const L: any;
// Chrome/Electron extension APIs (pref_storage); rich untyped global.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: any;
