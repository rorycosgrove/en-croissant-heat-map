import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { DEFAULT_SETTINGS, sanitizeSettings, type HeatmapSettings } from "./model";
const stored = atomWithStorage<HeatmapSettings>("heatmap-settings-v1", DEFAULT_SETTINGS, {
    getItem(key, initial) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? initial : sanitizeSettings(JSON.parse(raw));
        } catch {
            return initial;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            /* Continue with in-memory settings if storage is unavailable. */
        }
    },
    removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            /* Storage is optional. */
        }
    },
});
export const heatmapSettingsAtom = atom(
    (get) => get(stored),
    (get, set, value: unknown) => {
        set(stored, sanitizeSettings(value));
    },
);
