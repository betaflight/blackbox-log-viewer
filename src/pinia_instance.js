import { createPinia } from "pinia";

const pinia = createPinia();

window.__TEST_PINIA__ = pinia;

export default pinia;
