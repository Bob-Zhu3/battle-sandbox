import type { ARMIES, Team } from "./battlefield.ts";
import { pixelColor } from "./pixel-art/palette.ts";

export const INK = "#242339", FACE = "#ffcf93", IRON = "#91acb4", WOOD = "#d79a63";
export type Pens = CanvasRenderingContext2D;
export type Dye = (typeof ARMIES)[Team];

export function shape(c: Pens, path: Path2D, fill: string, width = 1.35) {
  c.fillStyle = pixelColor(fill); c.fill(path);
  if (width) { c.strokeStyle = INK; c.lineWidth = width; c.stroke(path); }
}
export function oval(c: Pens, x: number, y: number, rx: number, ry: number, fill: string) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  c.fillStyle = pixelColor(fill); c.fill();
}
export function line(c: Pens, x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
  c.strokeStyle = pixelColor(color); c.lineWidth = width; c.stroke();
}

// A single profile eye has to read through a helmet at playing size.
export function eye(c: Pens, x: number, y: number, rx: number, ry: number, lookX: number, lookY: number) {
  if (ry < .48) {
    line(c, x - rx + .3, y, x + rx - .1, y - .18, INK, .95);
    return;
  }
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  c.fillStyle = "#fffdf2"; c.fill();
  c.strokeStyle = INK; c.lineWidth = .7; c.stroke();
  oval(c, x + lookX * rx * .44, y + lookY * ry * .35, rx * .43, ry * .64, INK);
}

const paths = new Map<string, Path2D>();
export function cut(c: Pens, path: string, paint: string, width = 1.35) {
  let cached = paths.get(path);
  if (!cached) { cached = new Path2D(path); paths.set(path, cached); }
  shape(c, cached, paint, width);
}
export function limb(c: Pens, x: number, y: number, ex: number, ey: number, paint: string, width = 3) {
  line(c,x,y,ex,ey,INK,width+1.5); line(c,x,y,ex,ey,paint,width);
}
