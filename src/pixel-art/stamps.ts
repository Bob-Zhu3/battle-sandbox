import { ARMIES, type Team } from "../battlefield.ts";
import type { Pens } from "../ink.ts";

// Each symbol is a single opaque texel. K, m and S form the ink/steel ramp;
// d, c and h are the three team colors. Clear cells never pick up a team tint.
const base: Record<string, string> = {
  K: "#242339", m: "#516077", S: "#91acb4", I: "#e4eee4",
  b: "#684856", r: "#aa6654", f: "#e79c73", F: "#ffcf93",
  Y: "#ffc660", y: "#bd7746", W: "#fff2c4", t: "#84434e",
  O: "#ff793d", R: "#c43b45", v: "#85394f", g: "#6c9976",
  j: "#3c7181", a: "#74d0ce",
};
const stamps = new WeakMap<readonly string[], HTMLCanvasElement[]>();
export const ink = base.K;
export function stamp(c: Pens, team: Team, rows: readonly string[], x: number, y: number) {
  const teamNumber = team === "red" ? 0 : team === "blue" ? 1 : team === "violet" ? 2 : 3;
  let colors = stamps.get(rows);
  if (!colors) { colors = []; stamps.set(rows, colors); }
  let tile = colors[teamNumber];
  if (!tile) {
    const dye = ARMIES[team];
    const palette: Record<string,string> = { ...base, d:dye.hem, c:dye.coat, h:dye.light };
    tile = document.createElement("canvas");
    tile.width = Math.max(...rows.map(row => row.length)); tile.height = rows.length;
    const pen = tile.getContext("2d")!;
    rows.forEach((row, rowIndex) => {
      for (let i = 0; i < row.length; i++) {
        const symbol = row[i];
        if (symbol === ".") continue;
        pen.fillStyle = palette[symbol]; pen.fillRect(i, rowIndex, 1, 1);
      }
    });
    colors[teamNumber] = tile;
  }
  c.imageSmoothingEnabled = false;
  c.drawImage(tile, Math.round(x), Math.round(y));
}

// Integer steps maintain the thickness of aimed weapons as the joint moves.
export function segment(c: Pens, x: number, y: number, ex: number, ey: number, color: string, size = 1) {
  x = Math.round(x); y = Math.round(y); ex = Math.round(ex); ey = Math.round(ey);
  const dx = Math.abs(ex-x), dy = -Math.abs(ey-y);
  const sx = x<ex ? 1 : -1, sy = y<ey ? 1 : -1;
  let error = dx+dy;
  c.fillStyle = color;
  while (true) {
    c.fillRect(x, y, size, size);
    if (x===ex && y===ey) break;
    const e = 2*error;
    if (e >= dy) { error += dy; x += sx; }
    if (e <= dx) { error += dx; y += sy; }
  }
}
