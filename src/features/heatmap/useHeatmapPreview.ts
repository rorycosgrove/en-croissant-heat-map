import { useEffect, useState } from "react";
import type { Api } from "@lichess-org/chessground/api";
import { parseSquare, type Color } from "chessops";
import { previewMove, squareAtPointer, type PreviewPosition } from "./preview";
interface Options {
    fen: string;
    api: Api | null;
    enabled: boolean;
    editing: boolean;
    viewOnly: boolean;
    orientation?: Color;
}
interface PreviewState extends PreviewPosition {
    sourceFen: string;
    orientation: string;
}
/** Observes native drag state; never mutates the board, game tree or engine position. */
export function useHeatmapPreview({
    fen,
    api,
    enabled,
    editing,
    viewOnly,
    orientation: requestedOrientation,
}: Options): PreviewPosition | null {
    const [preview, setPreview] = useState<PreviewState | null>(null);
    const orientation = requestedOrientation ?? api?.state.orientation;
    useEffect(() => {
        setPreview(null);
        if (!api || !enabled || editing || viewOnly) return;
        let frame = 0,
            key = "",
            cancelled = false;
        const clear = () => {
            cancelAnimationFrame(frame);
            frame = 0;
            key = "";
            setPreview(null);
        };
        let suppressedDrag: typeof api.state.draggable.current;
        const cancelGesture = () => {
            suppressedDrag = api.state.draggable.current;
            clear();
        };
        const evaluate = (x: number, y: number) => {
            if (cancelled) return;
            const drag = api.state.draggable.current;
            if (
                !drag?.started ||
                drag === suppressedDrag ||
                drag.newPiece ||
                drag.piece.color !== api.state.turnColor
            ) {
                clear();
                return;
            }
            const to = squareAtPointer(x, y, api.state.dom.bounds(), api.state.orientation),
                from = parseSquare(drag.orig);
            if (to === null || from === undefined) {
                clear();
                return;
            }
            const nextKey = `${fen}:${from}:${to}:${api.state.orientation}`;
            if (nextKey === key) return;
            key = nextKey;
            // Respect application-level move restrictions in addition to chess legality.
            const dests = api.state.movable.dests?.get(drag.orig);
            const destName = String.fromCharCode(97 + (to % 8)) + (Math.floor(to / 8) + 1);
            const result = dests?.some((dest) => dest === destName)
                ? previewMove(fen, from, to)
                : null;
            setPreview(
                result ? { ...result, sourceFen: fen, orientation: api.state.orientation } : null,
            );
        };
        const onMove = (event: MouseEvent | TouchEvent) => {
            const point = "touches" in event ? event.touches[0] : event;
            if (!point) {
                clear();
                return;
            }
            const { clientX, clientY } = point;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => evaluate(clientX, clientY));
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("touchmove", onMove, { passive: true });
        const endings = ["mouseup", "touchend", "touchcancel", "pointercancel", "pointerup"];
        for (const name of endings) document.addEventListener(name, cancelGesture);
        window.addEventListener("blur", cancelGesture);
        window.addEventListener("resize", clear);
        const observer = new ResizeObserver(clear);
        observer.observe(api.state.dom.elements.board);
        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("touchmove", onMove);
            for (const name of endings) document.removeEventListener(name, cancelGesture);
            window.removeEventListener("blur", cancelGesture);
            window.removeEventListener("resize", clear);
        };
    }, [fen, api, enabled, editing, viewOnly, orientation]);
    return enabled &&
        !editing &&
        !viewOnly &&
        preview?.sourceFen === fen &&
        preview.orientation === orientation
        ? preview
        : null;
}
