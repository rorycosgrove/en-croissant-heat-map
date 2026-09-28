import { useEffect, useMemo, useRef, useState } from "react";
import type { Color } from "chessops";
import { useTranslation } from "react-i18next";
import { createDirectionalModel, type HeatField, type HeatModel } from "./field";
import type { HeatmapSettings } from "./model";
import { fieldToRgba } from "./render";

interface Props {
  fen: string;
  orientation: Color;
  settings: HeatmapSettings;
  createModel?: () => HeatModel;
}
export function HeatmapCanvas({
  fen,
  orientation,
  settings,
  createModel = createDirectionalModel,
}: Props) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const previous = useRef<HeatField | null>(null);
  const model = useMemo(createModel, [createModel]);
  const [error, setError] = useState(false);
  useEffect(() => () => model.reset(), [model]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!settings.enabled) {
      previous.current = null;
      model.reset();
      context?.clearRect(0, 0, element.width, element.height);
      setError(false);
      return;
    }
    if (!context) {
      setError(true);
      return;
    }
    model.setPosition(fen, settings);
    const target = model.getField();
    setError(!target);
    if (!target) {
      previous.current = null;
      context.clearRect(0, 0, element.width, element.height);
      return;
    }
    const source = previous.current?.resolution === target.resolution ? previous.current : target;
    const buffer = document.createElement("canvas");
    buffer.width = target.resolution;
    buffer.height = target.resolution;
    const bc = buffer.getContext("2d");
    if (!bc) {
      setError(true);
      return;
    }
    const image = bc.createImageData(target.resolution, target.resolution);
    let frame = 0,
      stopped = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now();
    let last = start;
    let current: HeatField = target;
    const draw = () => {
      const bounds = element.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.max(1, Math.round(bounds.width * dpr)),
        h = Math.max(1, Math.round(bounds.height * dpr));
      if (element.width !== w || element.height !== h) {
        element.width = w;
        element.height = h;
      }
      image.data.set(fieldToRgba(current.values, settings.scale, settings.opacity));
      bc.putImageData(image, 0, 0);
      context.save();
      context.clearRect(0, 0, w, h);
      context.imageSmoothingEnabled = true;
      if (orientation === "white") {
        context.translate(0, h);
        context.scale(1, -1);
      } else {
        context.translate(w, 0);
        context.scale(-1, 1);
      }
      context.drawImage(buffer, 0, 0, w, h);
      context.restore();
      previous.current = current;
    };
    const tick = (now: number) => {
      if (stopped) return;
      const fraction = reduced.matches ? 1 : Math.min(1, (now - start) / 120);
      if (model.animated && !reduced.matches) {
        model.advance(Math.min(0.05, Math.max(0, (now - last) / 1000)));
        current = model.getField() ?? target;
      } else if (fraction < 1 && source !== target) {
        const values = new Float32Array(target.values.length);
        for (let i = 0; i < values.length; i++)
          values[i] = source.values[i] + (target.values[i] - source.values[i]) * fraction;
        current = { values, resolution: target.resolution };
      } else current = target;
      last = now;
      draw();
      if ((fraction < 1 && source !== target) || (model.animated && !reduced.matches))
        frame = requestAnimationFrame(tick);
    };
    tick(start);
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    const motionChange = () => {
      cancelAnimationFrame(frame);
      tick(performance.now());
    };
    reduced.addEventListener("change", motionChange);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener("change", motionChange);
    };
  }, [fen, orientation, settings, model]);
  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {error && (
        <span
          role="status"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            zIndex: 3,
            background: "#20252d",
            color: "white",
            fontSize: 12,
            padding: 4,
            pointerEvents: "none",
          }}
        >
          {t("Heatmap.Unavailable", "Heatmap unavailable for this position")}
        </span>
      )}
    </>
  );
}
