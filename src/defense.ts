import type { Arrow } from "./arrows.ts";
import { ARMIES, TOWER, type Base } from "./battlefield.ts";
import type { Unit } from "./simulation.ts";
import { nearestEnemy } from "./targeting.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

// The lookout tracks one troop until it falls or leaves the circle. Scouts
// walking across one another cannot repeatedly restart the wind-up.
export function aimTower(base: Base, units: readonly Unit[], tick: number, tickRate: number, shots: Arrow[]): Base {
  if (base.hp <= 0) return base;
  const tracked = units.find(unit => unit.id === base.targetId && unit.hp > 0 && !unit.tunnel &&
    unit.team !== base.team && Math.hypot(unit.x - base.x, unit.y - base.y) <= TOWER.range);
  const target = tracked ?? nearestEnemy(base, units, TOWER.range);
  if (!target) return base.targetId == null ? base : { ...base, targetId: null, acquiredTick: null };
  const dx = target.x - base.x, dy = target.y - base.y;
  const distance = Math.hypot(dx, dy);
  const aimX = distance ? dx / distance : ARMIES[base.team].facing;
  const aimY = distance ? dy / distance : 0;
  const acquiredTick = tracked ? base.acquiredTick ?? tick : tick;
  const next = { ...base, aimX, aimY, acquiredTick, targetId: target.id };
  if (tick - acquiredTick < TOWER.sightTicks || tick - (base.lastShotTick ?? -Infinity) < TOWER.cooldownTicks) return next;
  next.lastShotTick = tick;
  const speed = TOWER.boltSpeed / tickRate;
  shots.push({ kind: "bolt", casterId: base.id, x: base.x, y: base.y, vx: speed * aimX, vy: speed * aimY,
    damage: TOWER.damage, team: base.team, releasedTick: tick });
  return next;
}

export function facesShot(unit: Unit, shot: Arrow) {
  const speed = Math.hypot(shot.vx, shot.vy);
  return speed > 0 && -(shot.vx * unit.aimX + shot.vy * unit.aimY) >= speed * UNIT_DEFINITIONS.shieldbearer.guardCosine;
}

export function incomingShot(unit: Unit, shots: readonly Arrow[]) {
  const guard = UNIT_DEFINITIONS.shieldbearer;
  return shots.some(shot => {
    if (shot.kind === "bomb" || shot.kind === "ice" || shot.kind === "hex" || shot.kind === "balloon" || shot.team === unit.team || !facesShot(unit, shot)) return false;
    const speed = Math.hypot(shot.vx, shot.vy);
    const dx = unit.x - shot.x, dy = unit.y - shot.y;
    const ahead = (dx * shot.vx + dy * shot.vy) / speed;
    const across = Math.abs(dx * shot.vy - dy * shot.vx) / speed;
    return ahead >= 0 && ahead <= guard.warningDistance && across <= guard.radius + 2;
  });
}
