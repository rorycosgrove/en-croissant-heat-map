import type { Board } from "chessops/board";
import type { Role, Square } from "chessops";
import { kingAttacks, knightAttacks, pawnAttacks } from "chessops/attacks";

export interface HeatmapSettings {
    enabled: boolean;
    activityContours: boolean;
    opacity: number;
    spread: number;
    decay: number;
    scale: number;
    weights: Record<Role, number>;
}
export const DEFAULT_SETTINGS: HeatmapSettings = {
    enabled: false,
    activityContours: true,
    opacity: 0.65,
    spread: 0.3,
    decay: 0.25,
    scale: 20,
    weights: { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 10, king: 3 },
};
const object = (v: unknown): Record<string, unknown> =>
    typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
const finite = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export function sanitizeSettings(input: unknown): HeatmapSettings {
    const s = object(input),
        w = object(s.weights);
    return {
        enabled: typeof s.enabled === "boolean" ? s.enabled : false,
        activityContours: typeof s.activityContours === "boolean" ? s.activityContours : true,
        opacity: finite(s.opacity, 0.65, 0, 1),
        spread: finite(s.spread, 0.3, 0.1, 1.5),
        decay: finite(s.decay, 0.25, 0, 2),
        scale: finite(s.scale, 20, 1, 100),
        weights: Object.fromEntries(
            Object.entries(DEFAULT_SETTINGS.weights).map(([role, value]) => [
                role,
                finite(w[role], value, 0, 30),
            ]),
        ) as Record<Role, number>,
    };
}
/** Board coordinates, centred at .5. No pixel or rendering dependencies. */
export interface InfluencePrimitive {
    kind: "spot" | "ray";
    from: Square;
    to: Square;
    x: number;
    y: number;
    dx: number;
    dy: number;
    length: number;
    strength: number;
    spread: number;
    decay: number;
}
const orthogonal = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
];
const diagonal = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
];
export function buildPrimitives(board: Board, input: HeatmapSettings): InfluencePrimitive[] {
    const settings = sanitizeSettings(input),
        result: InfluencePrimitive[] = [];
    for (const [from, piece] of board) {
        const strength = settings.weights[piece.role] * (piece.color === "white" ? -1 : 1);
        if (!strength) continue;
        const x = (from % 8) + 0.5,
            y = Math.floor(from / 8) + 0.5;
        result.push({
            kind: "spot",
            from,
            to: from,
            x,
            y,
            dx: 0,
            dy: 0,
            length: 0,
            strength,
            spread: 0.45,
            decay: 0,
        });
        const dirs =
            piece.role === "rook"
                ? orthogonal
                : piece.role === "bishop"
                  ? diagonal
                  : piece.role === "queen"
                    ? [...orthogonal, ...diagonal]
                    : null;
        if (dirs) {
            for (const [sx, sy] of dirs) {
                let to = from;
                for (let step = 1; step < 8; step++) {
                    const fx = (from % 8) + sx * step,
                        fy = Math.floor(from / 8) + sy * step;
                    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) break;
                    to = fy * 8 + fx;
                    if (board.has(to)) break;
                }
                if (to === from) continue;
                const vx = (to % 8) - (from % 8),
                    vy = Math.floor(to / 8) - Math.floor(from / 8),
                    length = Math.hypot(vx, vy);
                result.push({
                    kind: "ray",
                    from,
                    to,
                    x,
                    y,
                    dx: vx / length,
                    dy: vy / length,
                    length,
                    strength: strength * 0.5,
                    spread: settings.spread,
                    decay: settings.decay,
                });
            }
        } else {
            const targets =
                piece.role === "knight"
                    ? knightAttacks(from)
                    : piece.role === "king"
                      ? kingAttacks(from)
                      : pawnAttacks(piece.color, from);
            for (const to of targets) {
                const tx = (to % 8) + 0.5,
                    ty = Math.floor(to / 8) + 0.5;
                result.push({
                    kind: "spot",
                    from,
                    to,
                    x: tx,
                    y: ty,
                    dx: 0,
                    dy: 0,
                    length: 0,
                    strength:
                        strength * 0.5 * Math.exp(-settings.decay * Math.hypot(tx - x, ty - y)),
                    spread: settings.spread,
                    decay: 0,
                });
            }
        }
    }
    return result;
}
