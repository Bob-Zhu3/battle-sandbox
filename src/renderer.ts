import { ARENA, type Battle, type Warrior } from "./simulation.ts";
import { BRUSH_SPACING, teamAt, type ArenaPoint } from "./deployment.ts";

const colors = {
  red: { fill: "#e25d4b", edge: "#9b392f", light: "#ffab93", letter: "R" },
  blue: { fill: "#547ce0", edge: "#354e99", light: "#a8bfff", letter: "B" },
};

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
}

function drawField(ctx: CanvasRenderingContext2D, height: number, unitsPerPixel: number, deploying: boolean) {
  const width = ARENA.width;
  const midX = width / 2;
  const midY = height / 2;
  ctx.fillStyle = deploying ? "#f6eee8" : "#eef2e9";
  ctx.fillRect(0, 0, width, height);
  if (deploying) {
    ctx.fillStyle = "#ecf1f8";
    ctx.fillRect(midX, 0, midX, height);
  }

  ctx.fillStyle = "#cbd5c8";
  const dotSize = Math.max(1.3, 0.8 * unitsPerPixel);
  const rowSpacing = BRUSH_SPACING * height / ARENA.height;
  for (let x = BRUSH_SPACING / 2; x < width; x += BRUSH_SPACING) {
    for (let y = midY % rowSpacing; y < height; y += rowSpacing) {
      ctx.fillRect(x, y, dotSize, dotSize);
    }
  }

  const margin = Math.max(23, 11 * unitsPerPixel);
  ctx.strokeStyle = "#b8c5b5";
  ctx.lineWidth = 1.3;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.moveTo(midX, margin);
  ctx.lineTo(midX, height - margin);
  ctx.stroke();
  ctx.setLineDash([]);
  circle(ctx, midX, midY, 51);
  ctx.stroke();
  circle(ctx, midX, midY, 3);
  ctx.fillStyle = "#a4b49f";
  ctx.fill();

  ctx.beginPath();
  for (const left of [true, false]) {
    for (const top of [true, false]) {
      const x = left ? margin : width - margin;
      const y = top ? margin : height - margin;
      ctx.moveTo(x + (left ? 14 : -14), y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + (top ? 14 : -14));
    }
  }
  ctx.stroke();
}

function drawWarrior(ctx: CanvasRenderingContext2D, unit: Warrior, x: number, y: number, tick: number, discScale: number) {
  const color = colors[unit.team];
  const radius = 21;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(discScale, discScale);
  if (unit.hp === 0) {
    circle(ctx, 0, 0, radius);
    ctx.fillStyle = "#e0e6da";
    ctx.fill();
    ctx.strokeStyle = color.edge;
    ctx.lineWidth = 1.7;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(-5, -5); ctx.lineTo(5, 5);
    ctx.moveTo(5, -5); ctx.lineTo(-5, 5);
    ctx.stroke();
  } else {
    const sinceHit = unit.lastHitTick === null ? Infinity : tick - unit.lastHitTick;
    if (sinceHit < 12) {
      ctx.globalAlpha = (1 - sinceHit / 12) * 0.75;
      circle(ctx, 0, 0, radius + 3 + sinceHit * 0.9);
      ctx.strokeStyle = color.edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    circle(ctx, 0, 2.5, radius + 1);
    ctx.fillStyle = "#24352326";
    ctx.fill();
    circle(ctx, 0, 0, radius);
    ctx.fillStyle = sinceHit < 4 ? color.light : color.fill;
    ctx.fill();
    ctx.strokeStyle = color.edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius - 4, Math.PI * 1.12, Math.PI * 1.72);
    ctx.strokeStyle = color.light;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 16px 'Segoe UI', sans-serif";
    ctx.fillText(color.letter, 0, 1);
  }
  ctx.restore();
}

export function drawArena(ctx: CanvasRenderingContext2D, previous: Battle, current: Battle, blend: number, deploying = false, preview: readonly ArenaPoint[] = []) {
  const scale = ctx.canvas.width / ARENA.width;
  const unitsPerPixel = ARENA.width / Math.max(1, ctx.canvas.clientWidth);
  const height = ctx.canvas.height / scale;
  const yScale = height / ARENA.height;
  const radius = Math.max(11, 5 * unitsPerPixel);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawField(ctx, height, unitsPerPixel, deploying);
  for (const [index, unit] of current.warriors.entries()) {
    // Each simulation step preserves the order of the Warrior records.
    const from = previous.warriors[index];
    const x = from.x + (unit.x - from.x) * blend;
    const y = from.y + (unit.y - from.y) * blend;
    drawWarrior(ctx, unit, x, y * yScale, current.tick, radius / 21);
  }
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (const point of preview) {
    const color = colors[teamAt(point.x)];
    circle(ctx, point.x, point.y * yScale, radius);
    ctx.fillStyle = color.fill;
    ctx.fill();
    ctx.strokeStyle = color.edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}
