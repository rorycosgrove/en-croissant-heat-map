import { describe, expect, it } from "vitest";
import { parseSquare } from "chessops";
import { INITIAL_FEN, parseFen } from "chessops/fen";
import { previewMove, squareAtPointer } from "./preview";
const preview = (fen: string, a: string, b: string) =>
    previewMove(fen, parseSquare(a as "a1")!, parseSquare(b as "a1")!);
const at = (fen: string, s: string) =>
    parseFen(fen)
        .unwrap()
        .board.get(parseSquare(s as "a1")!);
describe("hypothetical positions", () => {
    it("previews legal moves without modifying input and rejects illegal/pinned moves", () => {
        const result = preview(INITIAL_FEN, "e2", "e4")!;
        expect(at(result.fen, "e2")).toBeUndefined();
        expect(at(result.fen, "e4")?.role).toBe("pawn");
        expect(at(INITIAL_FEN, "e2")?.role).toBe("pawn");
        expect(preview(INITIAL_FEN, "e2", "e5")).toBeNull();
        expect(preview("4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1", "e2", "d2")).toBeNull();
        expect(preview("bad", "e2", "e4")).toBeNull();
    });
    it("removes captures and en passant pawns", () => {
        const capture = preview("7k/8/8/3p4/4P3/8/8/K7 w - - 0 1", "e4", "d5")!;
        expect(at(capture.fen, "d5")).toMatchObject({ role: "pawn", color: "white" });
        const ep = preview("7k/8/8/3pP3/8/8/8/K7 w - d6 0 1", "e5", "d6")!;
        expect(at(ep.fen, "d5")).toBeUndefined();
        expect(at(ep.fen, "d6")?.color).toBe("white");
    });
    it("handles castling king and rook destinations", () => {
        for (const dest of ["g1", "h1"]) {
            const result = preview("4k3/8/8/8/8/8/8/4K2R w K - 0 1", "e1", dest)!;
            expect(at(result.fen, "g1")?.role).toBe("king");
            expect(at(result.fen, "f1")?.role).toBe("rook");
            expect(at(result.fen, "h1")).toBeUndefined();
        }
    });
    it("labels queen promotion preview", () => {
        const result = preview("7k/P7/8/8/8/8/8/K7 w - - 0 1", "a7", "a8")!;
        expect(result.promotes).toBe(true);
        expect(at(result.fen, "a8")?.role).toBe("queen");
    });
    it("maps orientation and rejects outside/zero bounds", () => {
        const bounds = { left: 10, top: 20, width: 800, height: 800 };
        expect(squareAtPointer(60, 70, bounds, "white")).toBe(56);
        expect(squareAtPointer(60, 70, bounds, "black")).toBe(7);
        expect(squareAtPointer(9, 70, bounds, "white")).toBeNull();
        expect(squareAtPointer(810, 70, bounds, "white")).toBeNull();
        expect(squareAtPointer(60, 70, { ...bounds, width: 0 }, "white")).toBeNull();
    });
});
