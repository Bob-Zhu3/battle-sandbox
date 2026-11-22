import { ARMIES, BASE_RADIUS } from "./battlefield.ts";
import type { Hit } from "./conditions.ts";
import type { Target, Unit } from "./simulation.ts";
import { exposed } from "./targeting.ts";
import { airborne, UNIT_DEFINITIONS } from "./units.ts";

export function pickTowerTarget(unit: Unit, targets: readonly Target[]) {
  const lobber = unit.kind === "lobber", spec = UNIT_DEFINITIONS[unit.kind];
  let nearest: Target | undefined, nearestDistance = Infinity;
  for (const target of targets) {
    if (target.team === unit.team || !exposed(target)) continue;
    const distance = Math.hypot(target.x-unit.x,target.y-unit.y);
    if (distance > spec.reach+(target.kind === "base" ? BASE_RADIUS : 0)) continue;
    if (lobber && (airborne(target) || distance < UNIT_DEFINITIONS.lobber.minimumRange)) continue;
    if (!lobber && target.id === unit.targetId) return target;
    if (distance < nearestDistance || (distance === nearestDistance && target.id < nearest!.id)) {
      nearest = target; nearestDistance = distance;
    }
  }
  return nearest;
}

export function prismLevel(age: number) {
  return Math.min(UNIT_DEFINITIONS.prism.maxLevel,1+Math.floor(Math.max(0,age)/UNIT_DEFINITIONS.prism.focusTicks));
}

export function channelPrism(unit: Unit, primary: Target | undefined, targets: readonly Target[], tick: number, hit: Hit) {
  if (!primary) {
    unit.targetId=null; delete unit.focusSince; delete unit.prismSides;
    return;
  }
  const rule=UNIT_DEFINITIONS.prism;
  if (unit.targetId!==primary.id || unit.focusSince===undefined) unit.focusSince=tick;
  unit.targetId=primary.id;
  const dx=primary.x-unit.x, dy=primary.y-unit.y, distance=Math.hypot(dx,dy);
  if (distance) {unit.aimX=dx/distance; unit.aimY=dy/distance;}
  const level=prismLevel(tick-unit.focusSince);
  const freeFacets=level<3 ? 2 : level<rule.maxLevel ? 1 : 0;
  const sides=freeFacets ? targets.filter(target=>{
    if (target.id===primary.id || target.team===unit.team || !exposed(target)) return false;
    const x=target.x-unit.x,y=target.y-unit.y;
    const range=rule.reach+(target.kind==="base" ? BASE_RADIUS : 0);
    return x*x+y*y<=range*range && x*unit.aimX+y*unit.aimY>=Math.abs(x*unit.aimY-y*unit.aimX);
  }).sort((a,b)=>Math.hypot(a.x-unit.x,a.y-unit.y)-Math.hypot(b.x-unit.x,b.y-unit.y) || a.id-b.id).slice(0,freeFacets) : [];
  if (sides.length) unit.prismSides=sides.map(t=>t.id); else delete unit.prismSides;
  if (tick<unit.nextAttackTick) return;
  hit(primary,rule.damage+level-1,unit.team);
  for (const side of sides) hit(side,rule.sideDamage,unit.team);
  unit.lastAttackTick=tick; unit.nextAttackTick=tick+rule.cooldownTicks;
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
