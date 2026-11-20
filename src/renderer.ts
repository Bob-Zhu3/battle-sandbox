import { ARENA, boundCenter, type Team } from "./simulation.ts";
import type { World } from "./room-protocol.ts";
import { teamAt, type ArenaPoint } from "./deployment.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

const colors = {
  red: { shell: "#e46950", shade: "#af453c", gleam: "#ffb685" },
  blue: { shell: "#5798cf", shade: "#3e6d9d", gleam: "#afddf1" },
};
const INK = "#293731";
const TAU = 2 * Math.PI;

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

// The brush stamp, placement preview and live unit share a silhouette.
export function drawUnitToken(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, side: Team, kind: UnitKind, flash = false) {
  const color = colors[side];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((side === "red" ? r : -r) / 16, r / 16);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  circle(ctx, 0, 0, 15);
  ctx.fillStyle = flash ? color.gleam : color.shell;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-13, 3);
  ctx.bezierCurveTo(-8, 11, 4, 14, 12, 5);
  ctx.bezierCurveTo(8, 17, -9, 17, -13, 3);
  ctx.fillStyle = color.shade;
  ctx.fill();

  if (kind === "archer") drawBow(ctx);
  else drawVisor(ctx, side);
  ctx.restore();
}

function drawBow(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-4, -10); ctx.lineTo(-9, 0); ctx.lineTo(-4, 10);
  ctx.strokeStyle = "#fff2c7";
  ctx.lineWidth = 1.35;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.bezierCurveTo(-1, -8, 5, -9, 6, 0);
  ctx.bezierCurveTo(5, 9, -1, 8, -4, 10);
  ctx.strokeStyle = INK; ctx.lineWidth = 4.8; ctx.stroke();
  ctx.strokeStyle = "#ffd077"; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-9, 0); ctx.lineTo(10, 0);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, 0); ctx.lineTo(7, -2.8); ctx.lineTo(7, 2.8); ctx.closePath();
  ctx.fillStyle = "#fff2c7"; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
}

function drawVisor(ctx: CanvasRenderingContext2D, side: Team) {
  // A cream visor with one eye facing the other army reads even at a small size.
  ctx.beginPath();
  ctx.moveTo(-7, -4);
  ctx.quadraticCurveTo(2, -1, 12, -5);
  ctx.lineTo(11, 2);
  ctx.quadraticCurveTo(6, 6, -2, 6);
  ctx.lineTo(-6, 3);
  ctx.closePath();
  ctx.fillStyle = "#fff2c7";
  ctx.fill();
  ctx.lineWidth = 1.65;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(7, -1);
  ctx.lineTo(7, 1.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.strokeStyle = colors[side].gleam;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  if (side === "red") {
    ctx.moveTo(-7, -9); ctx.quadraticCurveTo(-4, -12, 0, -12);
  } else {
    ctx.moveTo(-6, -9); ctx.lineTo(-3, -12);
    ctx.moveTo(-1, -9); ctx.lineTo(2, -12);
  }
  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number, side: Team) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The tip is the simulated point of impact.
  ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-2, 0);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.stroke();
  ctx.strokeStyle = "#ffd073"; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, 0); ctx.lineTo(-14, -3); ctx.lineTo(-17, -3);
  ctx.lineTo(-15, 0); ctx.lineTo(-17, 3); ctx.lineTo(-14, 3); ctx.closePath();
  ctx.fillStyle = colors[side].gleam; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = .85; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-5.5, -2.8); ctx.lineTo(-4.3, 0); ctx.lineTo(-5.5, 2.8); ctx.closePath();
  ctx.fillStyle = "#fff1c6"; ctx.fill(); ctx.stroke();
  ctx.restore();
}

function projection(w: number, h: number, current: World, deploying: boolean) {
  if (deploying || !current.units.length) {
    return { sx: w / ARENA.width, sy: h / ARENA.height, ox: 0, oy: 0 };
  }
  // Frame the skirmish with a uniform scale so touching circles also touch on screen.
  // Fallen units retain their last position, keeping the frame steady as ranks fall.
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const { x, y } of current.units) {
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  const tallPhone = w <= 720 && h > 450;
  const topMargin = tallPhone ? 132 : Math.min(78, h * .18);
  const bottomMargin = tallPhone ? 104 : Math.min(73, h * .17);
  const fieldHeight = Math.max(1, h - topMargin - bottomMargin);
  const usableWidth = w - 2 * Math.min(52, w * .065);
  const scale = Math.min(usableWidth / Math.max(w <= 720 ? 340 : 525, right - left + 48), fieldHeight / Math.max(235, bottom - top + 48));
  return {
    sx: scale, sy: scale,
    ox: w / 2 - (left + right) / 2 * scale,
    oy: topMargin + fieldHeight / 2 - (top + bottom) / 2 * scale,
  };
}

function drawDivider(ctx: CanvasRenderingContext2D, w: number, h: number, empty: boolean) {
  ctx.save();
  ctx.strokeStyle = "#78926080";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 8]);
  const x = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, Math.min(140, h * .24));
  if (empty) {
    ctx.lineTo(x, h * .46 - 53);
    ctx.moveTo(x, h * .46 + 54);
  }
  ctx.lineTo(x, h - Math.min(108, h * .22));
  ctx.stroke();
  ctx.restore();
}

export function drawArena(ctx: CanvasRenderingContext2D, previous: World, current: World, blend: number, deploying = false, preview: readonly ArenaPoint[] = [], brush: UnitKind = "warrior", ownTeam?: Team) {
  const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight;
  if (!w || !h) return;
  ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.height / h, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const { sx, sy, ox, oy } = projection(w, h, current, deploying);
  const scale = Math.min(sx, sy);
  if (deploying && ownTeam) {
    ctx.fillStyle = "rgba(52, 68, 51, .10)";
    ctx.fillRect(ownTeam === "red" ? w / 2 : 0, 0, w / 2, h);
  }
  if (deploying) drawDivider(ctx, w, h, !current.units.length && !preview.length);

  for (const unit of current.units) {
    if (unit.hp || unit.lastHitTick === null) continue;
    const age = current.tick - unit.lastHitTick;
    if (age >= 24) continue;
    const x = ox + unit.x * sx, y = oy + unit.y * sy;
    const r = UNIT_DEFINITIONS[unit.kind].radius * scale;
    ctx.save();
    ctx.globalAlpha = .46 * (1 - age / 24);
    ctx.strokeStyle = colors[unit.team].shade;
    ctx.lineWidth = Math.max(1, r * .15);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - .36 * r, y - .36 * r); ctx.lineTo(x + .36 * r, y + .36 * r);
    ctx.moveTo(x + .36 * r, y - .36 * r); ctx.lineTo(x - .36 * r, y + .36 * r);
    ctx.stroke();
    ctx.restore();
  }
  for (const [i, unit] of current.units.entries()) {
    if (!unit.hp) continue;
    const from = previous.units[i];
    const x = ox + (from.x + (unit.x - from.x) * blend) * sx;
    const y = oy + (from.y + (unit.y - from.y) * blend) * sy;
    const age = unit.lastHitTick === null ? Infinity : current.tick - unit.lastHitTick;
    const r = UNIT_DEFINITIONS[unit.kind].radius * scale;
    drawUnitToken(ctx, x, y, r, unit.team, unit.kind, age < 5);
    if (age < 8) {
      // A brief spark at the visor leaves the circular silhouette readable in a crowd.
      const direction = unit.team === "red" ? 1 : -1;
      ctx.save();
      ctx.translate(x + direction * r * .86, y - direction * r * (.67 + age * .055));
      ctx.scale(r * (1 - age / 9), r * (1 - age / 9));
      ctx.beginPath();
      ctx.moveTo(0, -.45); ctx.lineTo(.09, -.12); ctx.lineTo(.31, -.05); ctx.lineTo(.12, .06);
      ctx.lineTo(0, .37); ctx.lineTo(-.1, .09); ctx.lineTo(-.31, .01); ctx.lineTo(-.1, -.1);
      ctx.closePath();
      ctx.fillStyle = "#ffe9a0";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = .06;
      ctx.stroke();
      ctx.restore();
    }
  }
  for (const arrow of current.arrows) {
    const rewind = arrow.releasedTick === current.tick ? 0 : 1 - blend;
    const x = ox + (arrow.x - arrow.vx * rewind) * sx;
    const y = oy + (arrow.y - arrow.vy * rewind) * sy;
    drawArrow(ctx, x, y, Math.atan2(arrow.vy, arrow.vx), scale, arrow.team);
  }
  ctx.save();
  ctx.globalAlpha = .55;
  const radius = UNIT_DEFINITIONS[brush].radius;
  for (const point of preview) {
    const x = boundCenter(point.x, ARENA.width, radius), y = boundCenter(point.y, ARENA.height, radius);
    drawUnitToken(ctx, ox + x * sx, oy + y * sy, radius * scale, teamAt(point.x), brush);
  }
  ctx.restore();
}
