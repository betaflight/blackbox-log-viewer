import { defineStore } from "pinia";
import { ref } from "vue";

export const useWorkspaceStore = defineStore("workspace", () => {
  const workspaceGraphConfigs = ref([]);
  const activeWorkspace = ref(1);
  const bookmarkTimes = ref([]);

  function setActiveWorkspace(id) {
    activeWorkspace.value = id;
  }

  function setWorkspaceGraphConfigs(configs) {
    workspaceGraphConfigs.value = configs;
  }

  const showDefaultMenu = ref(false);

  /** Get title for a workspace slot (1-9, 0) */
  function getTitle(id) {
    const entry = workspaceGraphConfigs.value[id];
    return entry ? entry.title : null;
  }

  /** Check if a workspace slot has data */
  function hasWorkspace(id) {
    return workspaceGraphConfigs.value[id] !== null;
  }

  return {
    workspaceGraphConfigs,
    activeWorkspace,
    bookmarkTimes,
    setActiveWorkspace,
    setWorkspaceGraphConfigs,
    showDefaultMenu,
    getTitle,
    hasWorkspace,
  };
});
