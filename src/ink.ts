import type { ARMIES, Team } from "./battlefield.ts";

export const INK = "#26332f", FACE = "#fff0ca", IRON = "#d0d5bd", WOOD = "#e6ac57";
export type Pens = CanvasRenderingContext2D;
export type Dye = (typeof ARMIES)[Team];

export function shape(c: Pens, path: Path2D, fill: string, width = 1.35) {
  c.fillStyle = fill; c.fill(path);
  if (width) { c.strokeStyle = INK; c.lineWidth = width; c.stroke(path); }
}
export function oval(c: Pens, x: number, y: number, rx: number, ry: number, fill: string) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  c.fillStyle = fill; c.fill();
}
export function line(c: Pens, x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
