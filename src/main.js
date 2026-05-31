// Application entry point. Bootstraps the Blackbox viewer: the composable owns
// the renderer instances and imperative operations; Pinia stores hold state.
import { useBlackboxViewer } from "./composables/use_blackbox_viewer.js";

useBlackboxViewer();
