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

  function addBookmark(time) {
    bookmarkTimes.value.push(time);
  }

  function removeBookmark(index) {
    bookmarkTimes.value.splice(index, 1);
  }

  function clearBookmarks() {
    bookmarkTimes.value = [];
  }

  return {
    workspaceGraphConfigs,
    activeWorkspace,
    bookmarkTimes,
    setActiveWorkspace,
    setWorkspaceGraphConfigs,
    addBookmark,
    removeBookmark,
    clearBookmarks,
  };
});
