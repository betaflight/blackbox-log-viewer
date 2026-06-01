// Application entry point. Bootstraps the Blackbox viewer after the Vue app has
// mounted (vue_init.js runs first), so Vue-rendered canvases exist. The
// composable owns the renderer instances and imperative operations; Pinia
// stores hold state.
import { initBlackboxViewer } from "./composables/use_blackbox_viewer.js";

initBlackboxViewer();
