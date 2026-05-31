import { defineStore } from "pinia";
import { ref } from "vue";

interface WorkspaceEntry {
  title: string;
  graphConfig: unknown;
}
type WorkspaceConfigs = Array<WorkspaceEntry | null>;

export const useWorkspaceStore = defineStore("workspace", () => {
  const workspaceGraphConfigs = ref<WorkspaceConfigs>([]);
  const activeWorkspace = ref(1);
  const bookmarkTimes = ref<number[]>([]);

  function setActiveWorkspace(id: number) {
    activeWorkspace.value = id;
  }

  function setWorkspaceGraphConfigs(configs: WorkspaceConfigs) {
    workspaceGraphConfigs.value = configs;
  }

  const showDefaultMenu = ref(false);

  // Callbacks registered by main.js

  /** Get title for a workspace slot (1-9, 0) */
  function getTitle(id: number) {
    const entry = workspaceGraphConfigs.value[id];
    return entry ? entry.title : null;
  }

  /** Check if a workspace slot has data */
  function hasWorkspace(id: number) {
    return workspaceGraphConfigs.value[id] != null;
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
