import { ARMIES } from "./battlefield.ts";
import type { Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { TOWER_ART_SCALE } from "./tower-art.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

// Fit the four-sail drawing to a tower-sized token. The axle is measured in that drawing.
export const MILL_MODEL_SCALE = .76;
export const FAN_HUB_HEIGHT = 13.2;
export const FAN_HUB_OFFSET = 4.3;

export function fanGustProgress(unit: Unit | undefined, tick: number) {
  if (unit?.millFastUntil === undefined) return 0;
  const duration = UNIT_DEFINITIONS.windmill.spinTicks;
  // The extra motion completes two whole cycles. Its phase also matches the
  // normal spin and the traveling gust marks again when the power expires.
  return Math.max(0, Math.min(1, (tick - unit.millFastUntil + duration) / duration));
}

// Each mark travels away from the mouth, widens off-axis, then fades. Short
// tapered shapes leave the bodies and the arrow's change of course legible.
function airRibbon(c: Pens, distance: number, length: number, lane: number, phase: number, strong: boolean) {
  const end = distance + length;
  const flutter = Math.sin(phase * Math.PI * 2 + lane * 1.6);
  const fromY = lane * (2.3 + distance * .34);
  const toY = lane * (2.3 + end * .34) + 1.65 * flutter;
  const bend = (lane < 0 ? -1 : 1) * (1.7 + 2.4 * phase);
  const width = (strong ? 1.75 : 1.32) * (1 - .25 * phase);
  c.beginPath();
  c.moveTo(distance, fromY);
  c.bezierCurveTo(distance + .27 * length, fromY + bend + width, end - .24 * length, toY + bend + width, end, toY);
  c.bezierCurveTo(end - .22 * length, toY + bend - .45 * width, distance + .3 * length, fromY + bend - .5 * width, distance, fromY);
  c.closePath();
  c.fill();
}

export function drawFanWind(c: Pens, unit: Unit, tick: number, sx: number, sy: number) {
  if (!unit.hp || tick < Math.max(unit.stunnedUntil ?? 0, unit.frozenUntil ?? 0, unit.petrifiedUntil ?? 0)) return;
  const length = Math.hypot(unit.aimX, unit.aimY);
  const dx = length ? unit.aimX / length : ARMIES[unit.team].facing;
  const dy = length ? unit.aimY / length : 0;
  const definition = UNIT_DEFINITIONS.windmill;
  const artUnits = definition.radius * TOWER_ART_SCALE * MILL_MODEL_SCALE / 11;
  const figureScale = Math.min(sx, sy) * artUnits;
  const gust = fanGustProgress(unit, tick);
  const boosted = unit.millFastUntil !== undefined &&
    tick >= unit.millFastUntil - definition.spinTicks && tick < unit.millFastUntil;
  const age = tick - (unit.lastBlockTick ?? -Infinity);
  const deflection = age >= 0 && age < 12 ? 1 - age / 12 : 0;
  const range = definition.reach - FAN_HUB_OFFSET * artUnits;
  const lanes = boosted ? 4 : 3;

  c.save();
  c.translate(unit.x * sx + dx * FAN_HUB_OFFSET * figureScale,
    unit.y * sy - FAN_HUB_HEIGHT * figureScale + dy * FAN_HUB_OFFSET * figureScale);
  c.transform(dx * sx, dy * sy, -dy * sx, dx * sy, 0, 0);
  const breath = Math.sin(tick * .14 + unit.id);
  c.strokeStyle = "#75a6ac"; c.lineWidth = boosted ? 1.35 : 1.05; c.lineCap = "round";
  c.globalAlpha = boosted ? .78 : .63;
  c.beginPath();
  c.moveTo(9, -2.1);
  c.bezierCurveTo(15.8, -2.7 - breath, 21.9, -7.8 + breath, 28.5, -5.4 + breath);
  c.bezierCurveTo(32.4, -4.1 + breath, 33.2, -8.4 + breath, 30.1, -8.2 + breath);
  c.stroke();
  for (let i = 0; i < lanes; i++) {
    const lane = i === 0 ? -.82 : i === 1 ? .16 : i === 2 ? .86 : -.31;
    const offset = i === 3 ? .17 : i / 3;
    const phase = (unit.id * .173 + tick / 46 + offset + gust * 2) % 1;
    const span = 7 + Math.sin(Math.PI * phase) * (boosted ? 22 : 17);
    const depth = 4 + phase * (range - span - 5);
    const fade = Math.min(1, phase * 9, (1 - phase) * 5);
    const lit = boosted ? .85 : unit.targetId === null ? .59 : .70;
    c.globalAlpha = fade * (lit + (1 - lit) * deflection);
    c.fillStyle = i === 1 ? "#5c969c" : "#79abb0";
    airRibbon(c, depth, span, lane, phase, boosted);
  }
  c.restore();
}
