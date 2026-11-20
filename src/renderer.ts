import { ARENA, boundCenter, type Team } from "./simulation.ts";
import type { World } from "./room-protocol.ts";
import { teamAt, type ArenaPoint } from "./deployment.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";
import { characterPose, restingPose } from "./character-pose.ts";
import { drawFallen, drawUnitToken, INK, palette } from "./characters.ts";

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number, side: Team, length: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale * length, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The front of the shaft follows the simulated tip at bow height.
  ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-2, 0);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.stroke();
  ctx.strokeStyle = "#ffd073"; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, 0); ctx.lineTo(-14, -3); ctx.lineTo(-17, -3);
  ctx.lineTo(-15, 0); ctx.lineTo(-17, 3); ctx.lineTo(-14, 3); ctx.closePath();
  ctx.fillStyle = palette[side].light; ctx.fill();
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

export function drawArena(ctx: CanvasRenderingContext2D, previous: World, current: World, blend: number, deploying = false, preview: readonly ArenaPoint[] = [], brush: UnitKind = "warrior", view: { ownTeam?: Team; showIds?: boolean } = {}) {
  const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight;
  if (!w || !h) return;
  ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.height / h, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const { sx, sy, ox, oy } = projection(w, h, current, deploying);
  const scale = Math.min(sx, sy);
  if (deploying && view.ownTeam) {
    ctx.fillStyle = "rgba(52, 68, 51, .10)";
    ctx.fillRect(view.ownTeam === "red" ? w / 2 : 0, 0, w / 2, h);
  }
  if (deploying) drawDivider(ctx, w, h, !current.units.length && !preview.length);

  const tick = previous.tick + (current.tick - previous.tick) * blend;
  const byId = new Map(current.units.map(unit => [unit.id, unit]));
  const bodies = current.units.map((unit, i) => {
    const from = previous.units[i];
    return { unit, from, x: ox + (from.x + (unit.x - from.x) * blend) * sx, y: oy + (from.y + (unit.y - from.y) * blend) * sy };
  }).sort((a, b) => a.y - b.y || a.unit.id - b.unit.id);
  for (const { unit, x, y } of bodies) {
    if (unit.hp || unit.lastHitTick === null) continue;
    const age = Math.max(0, tick - unit.lastHitTick);
    if (age < 48) {
      const side = unit.aimX < 0 ? -1 : 1;
      drawFallen(ctx, x, y, UNIT_DEFINITIONS[unit.kind].radius * scale, unit.team, unit.kind, side, age);
    }
  }
  for (const { unit, from, x, y } of bodies) {
    if (!unit.hp) continue;
    const travel = from.walkDistance + (unit.walkDistance - from.walkDistance) * blend;
    const pose = deploying ? restingPose(unit.team === "red" ? 1 : -1)
      : characterPose(unit, unit.targetId === null ? undefined : byId.get(unit.targetId), tick, travel);
    const r = UNIT_DEFINITIONS[unit.kind].radius * scale;
    drawUnitToken(ctx, x, y, r, unit.team, unit.kind, pose);
    const hitAge = unit.lastHitTick === null ? Infinity : Math.max(0, tick - unit.lastHitTick);
    if (hitAge < 6) {
      ctx.save();
      ctx.translate(x + pose.side * r * .81, y - r * .65);
      ctx.scale(pose.side * scale, scale);
      ctx.globalAlpha = 1 - hitAge / 6;
      ctx.strokeStyle = "#fff2cd"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(1, -1); ctx.lineTo(3, -4); ctx.moveTo(3, 1); ctx.lineTo(6, 0); ctx.stroke();
      ctx.restore();
    }
  }
  for (const arrow of current.arrows) {
    const rewind = arrow.releasedTick === current.tick ? 0 : 1 - blend;
    const x = ox + (arrow.x - arrow.vx * rewind) * sx;
    const y = oy + (arrow.y - arrow.vy * rewind) * sy;
    const length = Math.min(1, Math.max(0, tick - arrow.releasedTick) / 3);
    if (length > 0) drawArrow(ctx, x, y - 7 * scale, Math.atan2(arrow.vy, arrow.vx), scale, arrow.team, length);
  }
  if (view.showIds) {
    ctx.save();
    ctx.font = '800 16px "Barlow Condensed", sans-serif';
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#f8f3df";
    ctx.fillStyle = INK;
    for (const unit of current.units) {
      const left = !deploying && unit.team === "red";
      const offset = UNIT_DEFINITIONS[unit.kind].radius * scale + 5;
      const x = ox + unit.x * sx + (left ? -offset : offset);
      const y = oy + unit.y * sy;
      const label = "#" + unit.id + (deploying ? "" : " · " + unit.hp + " HP");
      ctx.textAlign = left ? "right" : "left";
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    }
    ctx.restore();
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
