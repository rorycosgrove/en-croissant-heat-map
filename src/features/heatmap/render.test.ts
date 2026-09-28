import { expect, it } from "vitest";
import { fieldToRgba } from "./render";
it("maps fixed signed temperatures with symmetric saturation and transparent neutral", () => {
    const rgba = fieldToRgba(new Float32Array([-20, 0, 20, -200, 200]), 20, 0.65);
    expect(rgba[2]).toBeGreaterThan(rgba[0]);
    expect(rgba[8]).toBeGreaterThan(rgba[10]);
    expect(rgba[7]).toBe(0);
    expect(rgba[3]).toBe(rgba[11]);
    expect([...rgba.slice(0, 4)]).toEqual([...rgba.slice(12, 16)]);
    expect([...rgba.slice(8, 12)]).toEqual([...rgba.slice(16, 20)]);
    expect([...fieldToRgba(new Float32Array([20]), 20, 0.65)]).toEqual([...rgba.slice(8, 12)]);
    expect(fieldToRgba(new Float32Array([NaN]), 20, 1)[3]).toBe(0);
});
