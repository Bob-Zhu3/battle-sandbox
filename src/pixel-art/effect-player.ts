import { effects } from "./effects.ts";

type EffectName = keyof typeof effects;
const sheet = new Image();
sheet.src = new URL("./effects.png", import.meta.url).href;

export function whenEffectsLoad(paint: () => void) {
  if (!sheet.complete) sheet.addEventListener("load", paint, { once: true });
}

// The anchor is the effect author's ground/impact point, including off-center effects.
export function drawEffect(c: CanvasRenderingContext2D, name: EffectName, x: number, y: number,
  age: number, duration: number, width: number, facing = 1) {
  if (age < 0 || age >= duration || !sheet.complete || !sheet.naturalWidth) return false;
  const row = effects[name];
  const frame = Math.floor(age / duration * row.frames);
  const scale = width / row.w;
  c.save();
  c.translate(x, y);
  c.scale(facing * scale, scale);
  c.imageSmoothingEnabled = false;
  c.drawImage(sheet, frame % row.columns * row.w, row.y + Math.floor(frame / row.columns) * row.h,
    row.w, row.h, -row.ox, -row.oy, row.w, row.h);
  c.restore();
  return true;
}
