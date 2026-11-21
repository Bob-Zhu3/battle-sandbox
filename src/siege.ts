import { ARMIES, BASE_RADIUS } from "./battlefield.ts";
import type { Hit } from "./conditions.ts";
import type { Target, Unit } from "./simulation.ts";
import { exposed } from "./targeting.ts";
import { airborne, UNIT_DEFINITIONS } from "./units.ts";

export function pickTowerTarget(unit: Unit, targets: readonly Target[]) {
  const lens = unit.kind === "sunlens", spec = lens ? UNIT_DEFINITIONS.sunlens : UNIT_DEFINITIONS.lobber;
  let nearest: Target | undefined, nearestDistance = Infinity;
  for (const target of targets) {
    if (target.team === unit.team || !exposed(target)) continue;
    const distance = Math.hypot(target.x-unit.x,target.y-unit.y);
    if (distance > spec.reach+(target.kind === "base" ? BASE_RADIUS : 0)) continue;
    if (!lens && (airborne(target) || distance < UNIT_DEFINITIONS.lobber.minimumRange)) continue;
    if (lens && target.id === unit.targetId) return target;
    if (distance < nearestDistance || (distance === nearestDistance && target.id < nearest!.id)) {
      nearest = target; nearestDistance = distance;
    }
  }
  return nearest;
}

export function focusLens(unit: Unit, target: Target | undefined, tick: number, hit: Hit) {
  if (!target || (unit.fogUntil ?? 0)>tick) {
    unit.targetId = null; delete unit.focusSince;
    return;
  }
  const rule = UNIT_DEFINITIONS.sunlens;
  if (unit.targetId !== target.id || unit.focusSince === undefined) unit.focusSince = tick;
  unit.targetId = target.id;
  const dx = target.x-unit.x, dy = target.y-unit.y, distance = Math.hypot(dx,dy);
  unit.aimX = distance ? dx/distance : ARMIES[unit.team].facing; unit.aimY = distance ? dy/distance : 0;
  const age = tick-unit.focusSince;
  if (age < rule.focusTicks || tick < unit.nextAttackTick) return;
  const level = Math.min(3,1+Math.floor(age/rule.tierTicks));
  const amount = level === 3 ? rule.fullDamage : level === 2 ? rule.focusedDamage : rule.damage;
  hit(target,target.kind === "base" ? Math.ceil(amount/2) : amount,unit.team);
  unit.beam = {tick,x:target.x,y:target.y,level};
  unit.lastAttackTick = tick; unit.nextAttackTick = tick+rule.cooldownTicks;
}
