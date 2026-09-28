import { act } from "react";
import { createRoot } from "react-dom/client";
import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import { INITIAL_FEN } from "chessops/fen";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useHeatmapPreview } from "./useHeatmapPreview";
import * as previews from "./preview";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, board: HTMLDivElement, root: ReturnType<typeof createRoot>, api: Api;
let options = { fen: INITIAL_FEN, enabled: true, editing: false, viewOnly: false };
function Harness(props: typeof options & { orientation?: "white" | "black" }) {
  const preview = useHeatmapPreview({ ...props, api });
  return <output>{preview?.fen ?? "none"}</output>;
}
const flush = () =>
  act(() => {
    vi.advanceTimersByTime(20);
  });
const move = (x: number, y: number) => {
  act(() => document.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y })));
  flush();
};
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  board = document.createElement("div");
  document.body.append(host, board);
  root = createRoot(host);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  board.getBoundingClientRect = () => ({
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
  api = Chessground(board, {
    fen: INITIAL_FEN,
    animation: { enabled: false },
    movable: { color: "white", dests: new Map([["e2", ["e3", "e4"]]]) },
  });
  api.state.dom.bounds = Object.assign(board.getBoundingClientRect, { clear() {} });
  api.state.draggable.current = {
    orig: "e2",
    piece: { role: "pawn", color: "white" },
    origPos: [450, 650],
    pos: [450, 450],
    started: true,
    element: () => undefined,
    originTarget: board,
    keyHasChanged: true,
  };
  options = { fen: INITIAL_FEN, enabled: true, editing: false, viewOnly: false };
  act(() => root.render(<Harness {...options} orientation={api.state.orientation} />));
});
afterEach(() => {
  act(() => root.unmount());
  api.destroy();
  host.remove();
  board.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("previews legal hover once per destination without moving the real board", () => {
  const spy = vi.spyOn(previews, "previewMove");
  move(450, 450);
  expect(host.textContent).toContain("4P3");
  expect(api.getFen()).toContain("PPPPPPPP");
  move(455, 455);
  expect(spy).toHaveBeenCalledTimes(1);
  move(450, 350);
  expect(host.textContent).toBe("none");
});
it.each(["mouseup", "pointercancel", "touchcancel", "blur"])("clears on %s", (event) => {
  move(450, 450);
  expect(host.textContent).not.toBe("none");
  act(() => (event === "blur" ? window : document).dispatchEvent(new Event(event)));
  expect(host.textContent).toBe("none");
});
it("clears on outside, changed FEN, orientation and disabled mode", () => {
  move(450, 450);
  move(-2, 450);
  expect(host.textContent).toBe("none");
  move(450, 450);
  options = { ...options, fen: "7k/8/8/8/8/8/8/K7 w - - 0 1" };
  act(() => root.render(<Harness {...options} orientation={api.state.orientation} />));
  expect(host.textContent).toBe("none");
  options = { ...options, fen: INITIAL_FEN };
  act(() => root.render(<Harness {...options} orientation={api.state.orientation} />));
  move(450, 450);
  api.set({ orientation: "black" });
  act(() => root.render(<Harness {...options} orientation={api.state.orientation} />));
  expect(host.textContent).toBe("none");
  options = { ...options, enabled: false };
  act(() => root.render(<Harness {...options} orientation={api.state.orientation} />));
  move(350, 350);
  expect(host.textContent).toBe("none");
});
it("ignores editing, view only and opponent premoves", () => {
  for (const mode of ["editing", "viewOnly"] as const) {
    options = { ...options, [mode]: true };
    act(() => root.render(<Harness {...options} orientation={api.state.orientation} />));
    move(450, 450);
    expect(host.textContent).toBe("none");
    options = { ...options, [mode]: false };
  }
  options = { ...options };
  api.state.draggable.current!.piece.color = "black";
  act(() => root.render(<Harness {...options} orientation={api.state.orientation} />));
  move(450, 450);
  expect(host.textContent).toBe("none");
});

it.each(["blur", "pointercancel", "touchcancel"])(
  "does not resurrect a cancelled %s gesture",
  (event) => {
    move(450, 450);
    expect(host.textContent).not.toBe("none");
    act(() => (event === "blur" ? window : document).dispatchEvent(new Event(event)));
    move(455, 455);
    expect(host.textContent).toBe("none");
    api.state.draggable.current = { ...api.state.draggable.current! };
    move(450, 450);
    expect(host.textContent).not.toBe("none");
  },
);
