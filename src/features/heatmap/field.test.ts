import { describe, expect, it } from "vitest";
import { Board } from "chessops/board";
import { makeSquare, parseSquare, type Role, type Color } from "chessops";
import { buildPrimitives, DEFAULT_SETTINGS, sanitizeSettings } from "./model";
import { calculateField, sampleField, sampleInfluence, createDirectionalModel } from "./field";
function board(role: Role, color: Color = "white", square = "e4") {
    const b = Board.empty();
    b.set(parseSquare(square as "e4")!, { role, color });
    return b;
}
describe("directional temperature", () => {
    it("scales local heat by material and negates colour", () => {
        const pawn = sampleField(buildPrimitives(board("pawn"), DEFAULT_SETTINGS), 4.5, 3.5);
        const queen = sampleField(buildPrimitives(board("queen"), DEFAULT_SETTINGS), 4.5, 3.5);
        expect(pawn).toBeLessThan(0);
        expect(queen).toBeLessThan(pawn);
        const white = buildPrimitives(board("queen"), DEFAULT_SETTINGS);
        const black = buildPrimitives(board("queen", "black"), DEFAULT_SETTINGS);
        expect(sampleField(white, 5.2, 4.1)).toBeCloseTo(-sampleField(black, 5.2, 4.1), 8);
        const double = buildPrimitives(board("queen"), {
            ...DEFAULT_SETTINGS,
            weights: { ...DEFAULT_SETTINGS.weights, queen: 20 },
        });
        expect(sampleField(double, 5.2, 4.1)).toBeCloseTo(2 * sampleField(white, 5.2, 4.1), 8);
        expect(sampleField([...white, ...black], 5.2, 4.1)).toBeCloseTo(0, 8);
    });
    it("stops direct rays at either friendly or enemy blocker", () => {
        for (const color of ["white", "black"] as const) {
            const b = board("rook", "white", "a1");
            b.set(16, { role: "pawn", color });
            const rays = buildPrimitives(b, DEFAULT_SETTINGS).filter(
                (p) => p.kind === "ray" && p.from === 0,
            );
            expect(rays.map((p) => makeSquare(p.to))).toEqual(["h1", "a3"]);
            expect(sampleField(rays, 0.5, 4.5)).toBe(0);
        }
    });
    it("uses knight destinations without travel corridors", () => {
        const p = buildPrimitives(board("knight"), DEFAULT_SETTINGS).filter(
            (p) => p.kind === "spot" && p.to !== p.from,
        );
        expect(p.map((p) => makeSquare(p.to)).sort()).toEqual([
            "c3",
            "c5",
            "d2",
            "d6",
            "f2",
            "f6",
            "g3",
            "g5",
        ]);
    });
    it("uses diagonal pawn attacks and clips edge destinations", () => {
        const destinations = (c: Color, s: string) =>
            buildPrimitives(board("pawn", c, s), DEFAULT_SETTINGS)
                .filter((p) => p.from !== p.to)
                .map((p) => makeSquare(p.to))
                .sort();
        expect(destinations("white", "e4")).toEqual(["d5", "f5"]);
        expect(destinations("black", "e4")).toEqual(["d3", "f3"]);
        expect(destinations("white", "a8")).toEqual([]);
    });
    it("produces smooth finite fields, rejecting malformed FEN", () => {
        expect(calculateField("invalid", DEFAULT_SETTINGS)).toBeNull();
        const f = calculateField("8/8/8/8/4Q3/8/8/8 w - - 0 1", DEFAULT_SETTINGS)!;
        expect(f.values.length).toBe(128 * 128);
        expect(f.values.every(Number.isFinite)).toBe(true);
        const p = buildPrimitives(board("bishop"), DEFAULT_SETTINGS);
        expect(Math.abs(sampleField(p, 4.99, 3.99) - sampleField(p, 5.01, 4.01))).toBeLessThan(0.2);
        for (const n of [64, 128, 256]) {
            const f = calculateField("8/8/8/8/4Q3/8/8/8 w - - 0 1", DEFAULT_SETTINGS, n)!;
            const x = Math.floor((n * 4.5) / 8),
                y = Math.floor((n * 3.5) / 8);
            expect(f.values[y * n + x]).toBeCloseTo(
                sampleField(
                    buildPrimitives(board("queen"), DEFAULT_SETTINGS),
                    ((x + 0.5) * 8) / n,
                    ((y + 0.5) * 8) / n,
                ),
                4,
            );
        }
    });
    it("sanitizes invalid and extreme persisted settings", () => {
        const s = sanitizeSettings({
            scale: NaN,
            spread: -10,
            decay: Infinity,
            weights: { queen: 100, pawn: null },
            opacity: 9,
        });
        expect(s.scale).toBe(20);
        expect(s.spread).toBe(0.1);
        expect(s.decay).toBe(0.25);
        expect(s.weights.queen).toBe(30);
        expect(s.weights.pawn).toBe(1);
        expect(s.opacity).toBe(1);
    });
    it("supports replaceable model lifecycle without static time drift", () => {
        const model = createDirectionalModel();
        expect(model.getField()).toBeNull();
        model.setPosition("8/8/8/8/4Q3/8/8/8 w - - 0 1", DEFAULT_SETTINGS);
        const first = model.getField();
        model.advance(1 / 60);
        expect(model.getField()).toBe(first);
        model.reset();
        expect(model.getField()).toBeNull();
    });
});

it("accumulates converging pieces without losing opposing activity at neutrality", () => {
    const whiteBoard = Board.empty();
    whiteBoard.set(parseSquare("d1")!, { role: "rook", color: "white" });
    const one = sampleInfluence(buildPrimitives(whiteBoard, DEFAULT_SETTINGS), 3.5, 3.5);
    whiteBoard.set(parseSquare("a1")!, { role: "bishop", color: "white" });
    const two = sampleInfluence(buildPrimitives(whiteBoard, DEFAULT_SETTINGS), 3.5, 3.5);
    expect(two.white).toBeGreaterThan(one.white);
    expect(two.black).toBe(0);
    const opposing = Board.empty();
    opposing.set(parseSquare("d8")!, { role: "rook", color: "black" });
    const mirrored = Board.empty();
    mirrored.set(parseSquare("d1")!, { role: "rook", color: "white" });
    const field = [
        ...buildPrimitives(mirrored, DEFAULT_SETTINGS),
        ...buildPrimitives(opposing, DEFAULT_SETTINGS),
    ];
    const middle = sampleInfluence(field, 3.5, 4);
    expect(middle.white).toBeGreaterThan(0);
    expect(middle.white).toBeCloseTo(middle.black, 8);
    expect(middle.black - middle.white).toBeCloseTo(0, 8);
});

it("retains both nonnegative channels with temperature equal to black minus white", () => {
    const field = calculateField("3r4/8/8/8/8/8/8/3R4 w - - 0 1", DEFAULT_SETTINGS, 32)!;
    expect(field.white).toHaveLength(1024);
    expect(field.black).toHaveLength(1024);
    for (let i = 0; i < field.values.length; i++) {
        expect(field.white![i]).toBeGreaterThanOrEqual(0);
        expect(field.black![i]).toBeGreaterThanOrEqual(0);
        expect(field.values[i]).toBeCloseTo(field.black![i] - field.white![i], 5);
    }
});
