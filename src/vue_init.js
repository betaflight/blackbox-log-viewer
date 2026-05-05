import { createApp } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import App from "./App.vue";
import pinia from "./pinia_instance.js";
import { getNuxtUiRouter } from "./nuxt_ui_router.js";
import "./css/tailwind.css";

const app = createApp(App);
app.use(pinia);
app.use(getNuxtUiRouter());
app.use(ui);

const vm = app.mount("#vue-app");

// Expose Vue app instance for legacy code bridge
globalThis.vueApp = vm;
