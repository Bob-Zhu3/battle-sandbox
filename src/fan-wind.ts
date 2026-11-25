import { ARMIES } from "./battlefield.ts";
import type { Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { TOWER_ART_SCALE } from "./tower-art.ts";
import { UNIT_DEFINITIONS } from "./units.ts";
import { stamp } from "./pixel-art/stamps.ts";

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

// A crest rolls forward along each lane. The short tail and curled lip point
// away from the mill. The world transform below aims them with the actual wind.
const airCrests = [
  ["................aaaI..",".............aaa...Ia.",".......aaaaaj.......a.","...aaaaj............j.","aaa...............jj.."],
  ["...............aaI....","..........aaaaa..Ia...",".....aaaaj........a...","..aaaj............ja..","aa...............jj..."],
  ["...............aaa....","............aaa..Ia...",".......aaaaa......j...","..aaaaaj.........aj...","aa..............jj...."],
] as const;
const hubCurl=["..........aaaI.","........aa...Ia","....aaaa......j","aaaa........jj.","..........aa..."];

export function drawFanWind(c: Pens, unit: Unit, tick: number, sx: number, sy: number, bodyScale: number) {
  if (!unit.hp || tick < Math.max(unit.stunnedUntil ?? 0, unit.frozenUntil ?? 0, unit.petrifiedUntil ?? 0)) return;
  const length = Math.hypot(unit.aimX, unit.aimY);
  const dx = length ? unit.aimX / length : ARMIES[unit.team].facing;
  const dy = length ? unit.aimY / length : 0;
  const definition = UNIT_DEFINITIONS.windmill;
  const artUnits = definition.radius * TOWER_ART_SCALE * MILL_MODEL_SCALE / 11;
  const figureScale = bodyScale * artUnits;
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
  c.globalAlpha = boosted ? .86 : .68;
  stamp(c,unit.team,hubCurl,8,-4+breath);
  for (let i = 0; i < lanes; i++) {
    const lane = i === 0 ? -.82 : i === 1 ? .16 : i === 2 ? .86 : -.31;
    const offset = i === 3 ? .17 : i / 3;
    const phase = (unit.id * .173 + tick / 46 + offset + gust * 2) % 1;
    const span = 7 + Math.sin(Math.PI * phase) * (boosted ? 22 : 17);
    const depth = 4 + phase * (range - span - 5);
    const fade = Math.min(1, phase * 9, (1 - phase) * 5);
    const lit = boosted ? .85 : unit.targetId === null ? .59 : .70;
    c.globalAlpha = fade * (lit + (1 - lit) * deflection);
    const frame=Math.floor(phase*8)%airCrests.length;
    c.save(); c.translate(depth,lane*(2.3+depth*.34)); c.rotate(Math.atan(lane*.34));
    c.scale(span/22,(lane<0 ? -1 : 1)*(boosted ? 1.22 : 1));
    stamp(c,unit.team,airCrests[frame],0,-2);
    c.restore();
  }
  c.restore();
}
