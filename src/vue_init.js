import { createApp } from "vue";
import App from "./App.vue";
import pinia from "./pinia_instance.js";
import "./css/tailwind.css";

const app = createApp(App);
app.use(pinia);
app.mount("#vue-app");
