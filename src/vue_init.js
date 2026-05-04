import { createApp } from "vue";
import App from "./App.vue";
import pinia from "./pinia_instance.js";
import "./css/tailwind.css";

const app = createApp(App);
app.use(pinia);

const vm = app.mount("#vue-app");

// Expose Vue app instance for legacy code bridge
globalThis.vueApp = vm;
