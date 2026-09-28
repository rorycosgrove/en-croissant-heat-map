import { parseFen } from "chessops/fen";
import { buildPrimitives, type HeatmapSettings, type InfluencePrimitive } from "./model";
export interface HeatField {
    values: Float32Array;
    resolution: number;
}
/** Replace this backend with a time-dependent solver without changing board integration. */
export interface HeatModel {
    readonly animated?: boolean;
    setPosition(fen: string, settings: HeatmapSettings): void;
    advance(seconds: number): void;
    reset(): void;
    getField(): HeatField | null;
}
export function sampleField(primitives: InfluencePrimitive[], x: number, y: number): number {
    let total = 0;
    for (const p of primitives) {
        const rx = x - p.x,
            ry = y - p.y;
        let d2 = rx * rx + ry * ry,
            weight = 1;
        if (p.kind === "ray") {
            const along = rx * p.dx + ry * p.dy;
            // Compact axial envelope: direct projection never continues beyond a blocker.
            if (along <= 0 || along >= p.length + 0.5) continue;
            const across = rx * p.dy - ry * p.dx;
            d2 = across * across;
            const start = Math.min(1, along / 0.5),
                end = Math.min(1, (p.length + 0.5 - along) / 0.5);
            weight =
                start *
                start *
                (3 - 2 * start) *
                (end * end * (3 - 2 * end)) *
                Math.exp(-p.decay * along);
        }
        if (d2 > p.spread * p.spread * 18) continue;
        total += p.strength * weight * Math.exp(-d2 / (2 * p.spread * p.spread));
    }
    return total;
}
export function calculateField(
    fen: string,
    settings: HeatmapSettings,
    resolution = 128,
): HeatField | null {
    const setup = parseFen(fen);
    if (setup.isErr) return null;
    const n = Number.isFinite(resolution)
        ? Math.max(16, Math.min(256, Math.round(resolution)))
        : 128;
    const primitives = buildPrimitives(setup.value.board, settings),
        values = new Float32Array(n * n);
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++)
            values[y * n + x] = sampleField(primitives, ((x + 0.5) * 8) / n, ((y + 0.5) * 8) / n);
    return { values, resolution: n };
}
export function createDirectionalModel(): HeatModel {
    let field: HeatField | null = null;
    return {
        setPosition(fen, settings) {
            field = calculateField(fen, settings);
        },
        advance(_seconds) {},
        reset() {
            field = null;
        },
        getField() {
            return field;
        },
    };
}
