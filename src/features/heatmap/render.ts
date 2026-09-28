/** Signed temperature -> fixed diverging colour scale. Neutral reveals the board. */
export function fieldToRgba(
    values: Float32Array,
    scale: number,
    opacity: number,
): Uint8ClampedArray {
    const out = new Uint8ClampedArray(values.length * 4);
    const limit = Number.isFinite(scale) && scale > 0 ? scale : 20;
    for (let i = 0; i < values.length; i++) {
        const value = Number.isFinite(values[i]) ? values[i] : 0;
        const strength = Math.min(1, Math.abs(value) / limit);
        const colour = value < 0 ? [24, 148, 255] : [255, 65, 24];
        out[i * 4] = colour[0];
        out[i * 4 + 1] = colour[1];
        out[i * 4 + 2] = colour[2];
        out[i * 4 + 3] = Math.round(255 * Math.max(0, Math.min(1, opacity)) * Math.sqrt(strength));
    }
    return out;
}
