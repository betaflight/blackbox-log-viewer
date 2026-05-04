# Betaflight Blackbox Log Viewer

## Project Overview

PWA for analyzing Betaflight flight controller blackbox logs. Displays time-series graphs, FFT spectrum analysis, GPS maps, stick inputs, and 3D craft orientation from .bbl/.bfl log files.

**Migration in progress**: jQuery + Bootstrap 3 → Vue 3 + Nuxt UI + Tailwind CSS + Pinia. End goal: integrate as a tab in the Betaflight Configurator app.

## Tech Stack

### Current
- **Build**: Vite 7 + vite-plugin-pwa
- **UI**: jQuery 3, Bootstrap 3, jQuery UI
- **Rendering**: Canvas 2D (grapher, spectrum, seekbar) — framework-agnostic, stays as-is
- **Maps**: Leaflet + plugins
- **Utilities**: Lodash, throttle-debounce, html2canvas
- **Linting**: ESLint 10 (flat config), Prettier 3

### Target (matching Betaflight Configurator)
- **Framework**: Vue 3 (Options/Composition API)
- **UI Library**: Nuxt UI v4 (via `@nuxt/ui/vite`, not Nuxt framework)
- **CSS**: Tailwind CSS v4
- **State**: Pinia 3
- **Icons**: Lucide (via `@iconify-json/lucide`)
- **Build**: Vite (shared config with configurator)

## Architecture

### Core Modules (framework-agnostic, keep as-is)
- `flightlog_parser.js` — Binary log parser (variable-byte decoding)
- `flightlog.js` — Log indexing, caching (FIFOCache), frame retrieval
- `flightlog_fielddefs.js` — Field definitions, debug modes, flight mode names
- `flightlog_fields_presenter.js` — Human-readable field name mapping
- `datastream.js` — ArrayDataStream binary reader
- `decoders.js` — Custom encoding/decoding
- `imu.js` — Attitude estimation (complementary filter)
- `gps_transform.js` — GPS coordinate transforms
- `expo.js` — Exponential curve math
- `cache.js` — FIFO cache
- `tools.js` — Bit manipulation, binary search, time formatting
- `simple-stats.js` — Statistical calculations

### Canvas Renderers (keep as-is, wrap in Vue)
- `grapher.js` — Main graph renderer (FlightLogGrapher)
- `graph_spectrum_calc.js` — FFT computation
- `graph_spectrum_plot.js` — Spectrum renderer
- `graph_spectrum.js` — Analyser controller
- `seekbar.js` — Timeline/seekbar renderer
- `craft_2d.js` / `craft_3d.js` — Attitude visualization
- `sticks.js` — RC stick visualization
- `flightlog_video_renderer.js` — Video overlay

### Migrate to Vue Components
- `main.js` (2631 lines) — Break into Vue components + Pinia stores
- `graph_config_dialog.js` → Vue dialog component
- `header_dialog.js` → Vue dialog component
- `user_settings_dialog.js` → Vue dialog component
- `video_export_dialog.js` → Vue dialog component
- `graph_legend.js` → Vue component
- `graph_config.js` → Pinia store
- `workspace_menu.js` / `workspace_selection.js` → Vue components + store
- `configuration.js` → Vue component
- `dark_theme.js` → Use configurator's theme system
- `theme_colors.js` → Use configurator's CSS variables
- `pref_storage.js` → Use configurator's ConfigStorage

### Shared with Configurator (extract/import)
- Debug modes (`flightlog_fielddefs.js` ↔ `stores/debug.js`)
- Flight mode names and flags
- Theme colors and CSS variables
- PrefStorage / ConfigStorage pattern

## Commands
- `npm start` — Dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run lint:fix` — ESLint auto-fix
- `npm run format` — Prettier format

## Conventions
- ESLint flat config (`eslint.config.mjs`)
- Prettier 3 defaults (trailing commas)
- No TypeScript (plain JS, matching configurator)
- Canvas rendering code uses `requestAnimationFrame` patterns
- Modules use ES module exports
- CSS custom properties for theming (see `src/css/theme.css`)

## Configurator Reference
The Betaflight Configurator lives at: `../../betaflight-configurator/betaflight-configurator/`
- Tab system: `src/js/vue_tab_registry.js`, `src/js/tab_switch.js`
- Sidebar config: `src/components/sidebar/sidebar_items.js`
- Pinia stores: `src/stores/`
- Theme: `src/css/theme.css`
- Vite config: `vite.config.js`
- App entry: `src/components/init.js`
