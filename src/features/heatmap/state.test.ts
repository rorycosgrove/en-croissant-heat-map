import { createStore } from "jotai";
import { expect, it } from "vitest";
import { heatmapSettingsAtom } from "./state";
it("persists validated settings and reset restores defaults", () => {
    const store = createStore();
    const unsubscribe = store.sub(heatmapSettingsAtom, () => {});
    store.set(heatmapSettingsAtom, { enabled: true, weights: { queen: 12 } });
    expect(store.get(heatmapSettingsAtom).weights.queen).toBe(12);
    const other = createStore();
    const off = other.sub(heatmapSettingsAtom, () => {});
    expect(other.get(heatmapSettingsAtom).enabled).toBe(true);
    store.set(heatmapSettingsAtom, null);
    expect(store.get(heatmapSettingsAtom).weights.queen).toBe(10);
    expect(store.get(heatmapSettingsAtom).enabled).toBe(false);
    unsubscribe();
    off();
});
it("migrates old settings to activity contours and persists the comparison toggle", () => {
    localStorage.setItem(
        "heatmap-settings-v1",
        JSON.stringify({ enabled: true, weights: { queen: 10 } }),
    );
    const store = createStore();
    const off = store.sub(heatmapSettingsAtom, () => {});
    expect(store.get(heatmapSettingsAtom).activityContours).toBe(true);
    store.set(heatmapSettingsAtom, { ...store.get(heatmapSettingsAtom), activityContours: false });
    off();
    const other = createStore();
    const unsub = other.sub(heatmapSettingsAtom, () => {});
    expect(other.get(heatmapSettingsAtom).activityContours).toBe(false);
    unsub();
});
