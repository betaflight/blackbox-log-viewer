/**
 * Configuration
 *
 * Handle loading of configuration dump/diff files.
 * Parsed lines are pushed to graphStore for Vue rendering.
 */

import { useGraphStore } from "./stores/graph.js";

// Minimal shape of the PrefStorage passed in (pref_storage is still JS).
interface PrefStorageLike {
  get(key: string, callback: (item: unknown) => void): void;
  set(key: string, value: unknown): void;
}

export interface Configuration {
  getFile(): File;
}

export function Configuration(this: Configuration, file: File) {
  let fileData: File;

  function loadFile(file: File) {
    fileData = file;
    const reader = new FileReader();

    reader.onload = function (e) {
      // graph store is still JS; its configLines infers as never[].
      const graphStore = useGraphStore() as unknown as {
        configLines: string[];
        configFileName: string;
      };
      graphStore.configLines = (e.target!.result as string).split("\n");
      graphStore.configFileName = file.name;
    };
    reader.onerror = reader.onabort = function () {
      // graph store is still JS; its configLines infers as never[].
      const graphStore = useGraphStore() as unknown as {
        configLines: string[];
        configFileName: string;
      };
      graphStore.configLines = [];
      graphStore.configFileName = "";
    };

    reader.readAsText(file);
  }

  this.getFile = function () {
    return fileData;
  };

  loadFile(file);
}

export interface ConfigurationDefaults {
  loadFile(file: File): void;
  getFile(): File;
  getLines(): string[] | null;
  hasDefaults(): boolean;
  isDefault(line: string): boolean;
}

export function ConfigurationDefaults(
  this: ConfigurationDefaults,
  prefs: PrefStorageLike,
) {
  // Special configuration file that handles default values only

  let fileData: File;
  let fileLinesArray: string[] | null = null;

  function loadFileFromCache() {
    prefs.get("configurationDefaults", function (item) {
      if (item) {
        fileLinesArray = item as string[];
      } else {
        fileLinesArray = null;
      }
    });
  }

  this.loadFile = function (file) {
    const reader = new FileReader();
    fileData = file;

    reader.onload = function (e) {
      fileLinesArray = (e.target!.result as string).split("\n");
      prefs.set("configurationDefaults", fileLinesArray);
    };
    reader.onerror = reader.onabort = function () {
      fileLinesArray = null;
    };

    reader.readAsText(file);
  };

  this.getFile = function () {
    return fileData;
  };

  this.getLines = function () {
    return fileLinesArray;
  };

  this.hasDefaults = function () {
    return fileLinesArray !== null;
  };

  this.isDefault = function (line) {
    if (!fileLinesArray) {
      return true;
    }
    for (const fileLine of fileLinesArray) {
      if (line !== fileLine) {
        continue;
      }
      return true;
    }
    return false;
  };

  loadFileFromCache();
}
