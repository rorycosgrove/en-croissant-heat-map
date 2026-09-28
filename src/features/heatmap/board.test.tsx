import { act } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, expect, it, vi } from "vitest";
import { Chessground } from "@/chessground/Chessground";
import { DEFAULT_SETTINGS } from "./model";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
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
  addListener() {},
  removeListener() {},
}));
let dispose = () => {};
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
});
it("integrates a sibling canvas while retaining the native pieces and rerendering game positions", () => {
  const writes: number[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        clearRect() {},
        createImageData(w: number, h: number) {
          return { data: new Uint8ClampedArray(w * h * 4) };
        },
        putImageData(image: any) {
          writes.push(
            image.data.reduce(
              (sum: number, v: number, i: number) => sum + (i % 4 === 3 ? v : 0),
              0,
            ),
          );
        },
        drawImage() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
      }) as any,
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  dispose = () => {
    act(() => root.unmount());
    host.remove();
  };
  const settings = { ...DEFAULT_SETTINGS, enabled: true };
  const render = (fen: string) =>
    act(() =>
      root.render(
        <MantineProvider>
          <Chessground
            fen={fen}
            heatmap={{ fen, settings, editing: false, viewOnly: false }}
            animation={{ enabled: false }}
          />
        </MantineProvider>,
      ),
    );
  render("7k/8/8/8/4Q3/8/8/K7 w - - 0 1");
  expect(host.querySelector("canvas")).not.toBeNull();
  expect(host.querySelectorAll("piece").length).toBeGreaterThanOrEqual(3);
  expect(host.querySelector("cg-board canvas")).toBeNull();
  const old = writes.at(-1);
  render("7k/8/8/8/4P3/8/8/K7 w - - 0 1");
  expect(writes.at(-1)).not.toBe(old);
});

it("stops native drag animation when the board unmounts", () => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 800,
    bottom: 800,
    width: 800,
    height: 800,
    toJSON() {},
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let unmounted = false;
  dispose = () => {
    if (!unmounted) act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  };
  act(() =>
    root.render(
      <MantineProvider>
        <Chessground
          fen="7k/8/8/8/4Q3/8/8/K7 w - - 0 1"
          trustAllEvents={true}
          draggable={{ enabled: true, autoDistance: false, distance: 0 }}
          animation={{ enabled: false }}
        />
      </MantineProvider>,
    ),
  );
  const board = host.querySelector("cg-board")!;
  act(() =>
    board.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, clientX: 450, clientY: 450, buttons: 1 }),
    ),
  );
  act(() =>
    document.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX: 550, clientY: 450, buttons: 1 }),
    ),
  );
  act(() => vi.advanceTimersByTime(50));
  expect(host.querySelector("piece.dragging")).not.toBeNull();
  act(() => root.unmount());
  unmounted = true;
  act(() => vi.advanceTimersByTime(200));
  expect(vi.getTimerCount()).toBe(0);
});
