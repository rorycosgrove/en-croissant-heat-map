import type { HeatField } from "./field";
export type ContourSegment = [number, number, number, number];
/** No activity can be inferred from temperature alone: missing channels produce no overlay. */
export function activityValues(field: HeatField): Float32Array | null {
    const { white, black, resolution } = field;
    if (
        !white ||
        !black ||
        white.length !== resolution * resolution ||
        black.length !== white.length
    )
        return null;
    const total = new Float32Array(white.length);
    for (let i = 0; i < white.length; i++) {
        if (
            !Number.isFinite(white[i]) ||
            !Number.isFinite(black[i]) ||
            white[i] < 0 ||
            black[i] < 0
        )
            return null;
        total[i] = white[i] + black[i];
        if (!Number.isFinite(total[i])) return null;
    }
    return total;
}
export function contourLevels(scale: number): number[] {
    const limit = Number.isFinite(scale) && scale > 0 ? scale : 20;
    return [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1].map((fraction) => fraction * limit);
}
/** Piecewise-linear isolines, coordinates normalized to the board. No per-frame rescaling. */
export function activityContours(
    values: Float32Array,
    n: number,
    levels: number[],
): ContourSegment[] {
    if (!Number.isInteger(n) || n < 2 || n > 256 || values.length !== n * n) return [];
    const segments: ContourSegment[] = [];
    type Vertex = [number, number, number];
    const triangle = (vertices: Vertex[], level: number) => {
        const points: [number, number][] = [];
        for (let e = 0; e < 3; e++) {
            const a = vertices[e],
                b = vertices[(e + 1) % 3];
            if (a[2] >= level === b[2] >= level) continue;
            const ratio = (level - a[2]) / (b[2] - a[2]);
            points.push([a[0] + ratio * (b[0] - a[0]), a[1] + ratio * (b[1] - a[1])]);
        }
        if (
            points.length === 2 &&
            Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]) > 1e-12
        )
            segments.push([points[0][0], points[0][1], points[1][0], points[1][1]]);
    };
    for (let y = 0; y < n - 1; y++)
        for (let x = 0; x < n - 1; x++) {
            const a: Vertex = [(x + 0.5) / n, (y + 0.5) / n, values[y * n + x]],
                b: Vertex = [(x + 1.5) / n, (y + 0.5) / n, values[y * n + x + 1]],
                c: Vertex = [(x + 1.5) / n, (y + 1.5) / n, values[(y + 1) * n + x + 1]],
                d: Vertex = [(x + 0.5) / n, (y + 1.5) / n, values[(y + 1) * n + x]];
            if (![a[2], b[2], c[2], d[2]].every(Number.isFinite)) continue;
            const min = Math.min(a[2], b[2], c[2], d[2]),
                max = Math.max(a[2], b[2], c[2], d[2]);
            for (const level of levels)
                if (Number.isFinite(level) && level > min && level <= max) {
                    triangle([a, b, c], level);
                    triangle([a, c, d], level);
                }
        }
    return segments;
}
export function interpolateFields(
    source: HeatField,
    target: HeatField,
    fraction: number,
): HeatField {
    if (
        source.resolution !== target.resolution ||
        source.values.length !== target.values.length ||
        fraction >= 1
    )
        return target;
    const t = Number.isFinite(fraction) ? Math.max(0, fraction) : 1;
    const mix = (a: Float32Array, b: Float32Array) => {
        const values = new Float32Array(a.length);
        for (let i = 0; i < values.length; i++) values[i] = a[i] + (b[i] - a[i]) * t;
        return values;
    };
    const result: HeatField = {
        values: mix(source.values, target.values),
        resolution: target.resolution,
    };
    if (
        source.white &&
        target.white &&
        source.black &&
        target.black &&
        source.white.length === source.values.length &&
        target.white.length === target.values.length &&
        source.black.length === source.values.length &&
        target.black.length === target.values.length
    ) {
        result.white = mix(source.white, target.white);
        result.black = mix(source.black, target.black);
    }
    return result;
}
