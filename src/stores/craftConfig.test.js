import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCraftConfigStore } from "./craftConfig.js";

function fileFromText(text, name = "dump.txt") {
  return new File([text], name, { type: "text/plain" });
}

describe("useCraftConfigStore", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("starts empty when nothing is cached", () => {
    const store = useCraftConfigStore();
    expect(store.hasConfig).toBe(false);
    expect(store.craftName).toBeNull();
    expect(store.settingCount).toBe(0);
  });

  it("parses and stores a loaded file", async () => {
    const store = useCraftConfigStore();
    const text = ['set name = "My Heli"', "set main_rotor_gear_ratio = 15,137"].join("\n");

    await store.loadFile(fileFromText(text, "my-heli-dump.txt"));

    expect(store.hasConfig).toBe(true);
    expect(store.fileName).toBe("my-heli-dump.txt");
    expect(store.craftName).toBe("My Heli");
    expect(store.settingCount).toBe(2);
    expect(store.loadedAt).toEqual(expect.any(Number));
  });

  it("computes the main/tail rotor gear ratios from the loaded settings", async () => {
    const store = useCraftConfigStore();
    const text = ["set main_rotor_gear_ratio = 15,137", "set tail_rotor_gear_ratio = 1,4.66"].join(
      "\n",
    );

    await store.loadFile(fileFromText(text));

    expect(store.mainRotorGearRatio).toBeCloseTo(137 / 15);
    expect(store.tailRotorGearRatio).toBeCloseTo(4.66);
  });

  it("clears the loaded config", async () => {
    const store = useCraftConfigStore();
    await store.loadFile(fileFromText("set name = \"My Heli\""));
    expect(store.hasConfig).toBe(true);

    store.clear();

    expect(store.hasConfig).toBe(false);
    expect(store.craftName).toBeNull();
    expect(store.fileName).toBeNull();
  });

  it("persists the loaded config so a fresh store picks it up from cache", async () => {
    const store = useCraftConfigStore();
    await store.loadFile(fileFromText('set name = "My Heli"', "cached.txt"));

    // Simulate a fresh app load: new Pinia instance, new store, restore from PrefStorage.
    setActivePinia(createPinia());
    const reloadedStore = useCraftConfigStore();
    await reloadedStore.loadFromCache();

    expect(reloadedStore.hasConfig).toBe(true);
    expect(reloadedStore.fileName).toBe("cached.txt");
    expect(reloadedStore.craftName).toBe("My Heli");
  });

  it("does not persist anything after clear(), so a fresh store stays empty", async () => {
    const store = useCraftConfigStore();
    await store.loadFile(fileFromText('set name = "My Heli"'));
    store.clear();

    setActivePinia(createPinia());
    const reloadedStore = useCraftConfigStore();
    await reloadedStore.loadFromCache();

    expect(reloadedStore.hasConfig).toBe(false);
  });
});
