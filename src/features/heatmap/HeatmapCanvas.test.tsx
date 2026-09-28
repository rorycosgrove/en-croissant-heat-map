import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeatmapCanvas } from "./HeatmapCanvas";
import { DEFAULT_SETTINGS } from "./model";
import type { HeatModel } from "./field";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const events: string[] = [];
const fakeModel = (): HeatModel => ({
  setPosition(fen) {
    events.push(fen);
  },
  advance() {},
  reset() {
    events.push("reset");
  },
  getField() {
    return { values: new Float32Array(256).fill(1), resolution: 16 };
  },
});
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  events.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        clearRect() {},
        createImageData(w: number, h: number) {
          return { data: new Uint8ClampedArray(w * h * 4) };
        },
        putImageData() {},
        drawImage() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
        setTransform() {},
      }) as any,
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("skips calculation when disabled and updates on position changes", () => {
  const factory = vi.fn(fakeModel);
  act(() =>
    root.render(
      <HeatmapCanvas
        fen="first"
        orientation="white"
        settings={DEFAULT_SETTINGS}
        createModel={factory}
      />,
    ),
  );
  expect(events.filter((x) => x !== "reset")).toEqual([]);
  act(() =>
    root.render(
      <HeatmapCanvas
        fen="first"
        orientation="white"
        settings={{ ...DEFAULT_SETTINGS, enabled: true }}
        createModel={factory}
      />,
    ),
  );
  act(() =>
    root.render(
      <HeatmapCanvas
        fen="second"
        orientation="white"
        settings={{ ...DEFAULT_SETTINGS, enabled: true }}
        createModel={factory}
      />,
    ),
  );
  expect(events.filter((x) => x !== "reset")).toEqual(["first", "second"]);
  expect(container.querySelector("canvas")?.style.pointerEvents).toBe("none");
});
it("reports invalid positions without crashing and keeps independent models", () => {
  const invalid: HeatModel = { ...fakeModel(), getField: () => null };
  act(() =>
    root.render(
      <HeatmapCanvas
        fen="bad"
        orientation="white"
        settings={{ ...DEFAULT_SETTINGS, enabled: true }}
        createModel={() => invalid}
      />,
    ),
  );
  expect(container.querySelector('[role="status"]')?.textContent).toContain("unavailable");
});
it("draws contours for balanced activity and disables them for v1 comparison", () => {
  const lines: number[][] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        clearRect() {},
        createImageData(w: number, h: number) {
          return { data: new Uint8ClampedArray(w * h * 4) };
        },
        putImageData() {},
        drawImage() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
        setTransform() {},
        beginPath() {},
        moveTo(x: number, y: number) {
          lines.push([x, y]);
        },
        lineTo(x: number, y: number) {
          lines.push([x, y]);
        },
        stroke() {},
      }) as any,
  );
  const sides = Float32Array.from({ length: 256 }, (_, i) => i % 16);
  const factory = () => ({
    ...fakeModel(),
    getField: () => ({ values: new Float32Array(256), white: sides, black: sides, resolution: 16 }),
  });
  const render = (activityContours: boolean) =>
    act(() =>
      root.render(
        <HeatmapCanvas
          fen="balanced"
          orientation="white"
          settings={{ ...DEFAULT_SETTINGS, enabled: true, activityContours }}
          createModel={factory}
        />,
      ),
    );
  render(true);
  expect(lines.length).toBeGreaterThan(0);
  lines.length = 0;
  render(false);
  expect(lines).toHaveLength(0);
});
