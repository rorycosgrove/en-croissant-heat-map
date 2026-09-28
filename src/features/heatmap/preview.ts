import type { Color, Square } from "chessops";
import { Chess, normalizeMove } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
export interface PreviewPosition {
    fen: string;
    promotes: boolean;
}
export function previewMove(fen: string, from: Square, to: Square): PreviewPosition | null {
    const parsed = parseFen(fen);
    if (parsed.isErr) return null;
    const setup = Chess.fromSetup(parsed.value);
    if (setup.isErr) return null;
    const pos = setup.value.clone(),
        piece = pos.board.get(from);
    const promotes = piece?.role === "pawn" && (to < 8 || to >= 56);
    const move = normalizeMove(pos, {
        from,
        to,
        ...(promotes ? { promotion: "queen" as const } : {}),
    });
    if (!pos.isLegal(move)) return null;
    pos.play(move);
    return { fen: makeFen(pos.toSetup()), promotes };
}
export function squareAtPointer(
    clientX: number,
    clientY: number,
    bounds: { left: number; top: number; width: number; height: number },
    orientation: Color,
): Square | null {
    if (
        bounds.width <= 0 ||
        bounds.height <= 0 ||
        !Number.isFinite(clientX) ||
        !Number.isFinite(clientY)
    )
        return null;
    const x = Math.floor(((clientX - bounds.left) * 8) / bounds.width),
        y = Math.floor(((clientY - bounds.top) * 8) / bounds.height);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return orientation === "white" ? (7 - y) * 8 + x : y * 8 + 7 - x;
}
