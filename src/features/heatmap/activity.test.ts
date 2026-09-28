import { describe, expect, it } from "vitest";
import { activityValues, activityContours, interpolateFields, contourLevels } from "./activity";
import type { HeatField } from "./field";
const balanced: HeatField = {
    values: new Float32Array(4),
    white: new Float32Array([0, 5, 0, 5]),
    black: new Float32Array([0, 5, 0, 5]),
    resolution: 2,
};
describe("combined activity", () => {
    it("distinguishes neutral opposition from inactivity without changing temperature", () => {
        expect([...activityValues(balanced)!]).toEqual([0, 10, 0, 10]);
        expect([...balanced.values]).toEqual([0, 0, 0, 0]);
        expect(activityContours(activityValues(balanced)!, 2, [5]).length).toBe(2);
        expect(activityContours(new Float32Array(4), 2, [5])).toEqual([]);
    });
    it("uses fixed contour levels and consistent interpolated crossing coordinates", () => {
        expect(contourLevels(20)).toEqual([1.25, 2.5, 5, 10, 20]);
        const lines = activityContours(new Float32Array([0, 2, 0, 2]), 2, [1]);
        expect(lines).toHaveLength(2);
        for (const [x1, y1, x2, y2] of lines) {
            expect(x1).toBeCloseTo(0.5);
            expect(x2).toBeCloseTo(0.5);
            expect(y1).toBeGreaterThanOrEqual(0.25);
            expect(y2).toBeLessThanOrEqual(0.75);
        }
    });
    it("avoids misleading contours from missing, negative or invalid channels", () => {
        expect(activityValues({ values: new Float32Array(4), resolution: 2 })).toBeNull();
        expect(activityValues({ ...balanced, white: new Float32Array([NaN, 1, 1, 1]) })).toBeNull();
        expect(activityValues({ ...balanced, black: new Float32Array([-1, 1, 1, 1]) })).toBeNull();
        expect(activityValues({ ...balanced, white: new Float32Array(1) })).toBeNull();
        expect(activityContours(new Float32Array(4).fill(5), 2, [5])).toEqual([]);
    });
    it("interpolates activity alongside temperature without losing cancelled influence", () => {
        const empty = { ...balanced, white: new Float32Array(4), black: new Float32Array(4) };
        const halfway = interpolateFields(empty, balanced, 0.5);
        expect([...activityValues(halfway)!]).toEqual([0, 5, 0, 5]);
        expect([...halfway.values]).toEqual([0, 0, 0, 0]);
        expect(interpolateFields(empty, balanced, 1)).toBe(balanced);
        expect(
            activityValues(
                interpolateFields({ values: new Float32Array(4), resolution: 2 }, balanced, 0.5),
            ),
        ).toBeNull();
    });
});
