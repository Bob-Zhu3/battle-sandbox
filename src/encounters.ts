import { ARENA, BASE_RADIUS } from "./battlefield.ts";
import type { GroundEffect, Hit } from "./conditions.ts";
import type { Unit, Target, Placement } from "./simulation.ts";
import { nearestEnemy } from "./targeting.ts";
import { isHuman, isMachine, UNIT_DEFINITIONS } from "./units.ts";

export interface Windup { kind: "smash" | "swallow"; since: number; x: number; y: number; targetId: number }
const club = UNIT_DEFINITIONS.cyclops;
const storm = UNIT_DEFINITIONS.kirin;

function within(a: {x: number; y: number}, b: {x: number; y: number}, range: number) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= range ** 2;
}

export function startCyclopsSwing(unit: Unit, units: readonly Unit[], target: Target, tick: number, distance: number) {
  if (tick >= (unit.nextSwallowTick ?? 0)) {
    const humans = units.filter(u => isHuman(u.kind) && u.hp <= club.swallowHp);
    const meal = nearestEnemy(unit, humans, club.swallowRange);
    if (meal) {
      const dx = meal.x - unit.x, dy = meal.y - unit.y, length = Math.hypot(dx, dy) || 1;
      unit.aimX = dx / length; unit.aimY = dy / length;
      unit.targetId = meal.id;
      unit.windup = { kind: "swallow", since: tick, x: meal.x, y: meal.y, targetId: meal.id };
      return;
    }
  }
  if (tick < unit.nextAttackTick || distance > club.reach + (target.kind === "base" ? BASE_RADIUS : 0)) return;
  unit.windup = { kind: "smash", since: tick, x: unit.x + unit.aimX * 26, y: unit.y + unit.aimY * 26, targetId: target.id };
}

// Instant bolts and startle reactions interrupt a charge before its contact tick.
// Two slams landing together resolve by who started winding up first, then by ID.
export function resolveControl(units: readonly Unit[], targets: readonly Target[], tick: number, hit: Hit, effects: GroundEffect[]) {
  const stuns = new Map<number, number>();
  const arcs = new Map<number, NonNullable<Unit["arc"]>>();
  const mice = new Map<number, number>();
  const finished = new Set<number>();
  const meals = new Map<number, Unit>();
  const swallowed = new Set<number>();
  const shocks = new Map<number, Windup[]>();
  const disable = (id: number, duration: number) => stuns.set(id, Math.max(stuns.get(id) ?? 0, tick + duration));
  for (const u of units) {
    if (u.hp <= 0 || (u.stunnedUntil ?? 0) > tick) continue;
    if (u.kind === "cyclops" && tick - (u.lastStartleTick ?? -Infinity) >= 165) {
      let mouse: Unit | undefined, closest = 30 ** 2;
      for (const other of units) {
        if (other.kind !== "mouse" || other.hp <= 0) continue;
        const d = (other.x-u.x)**2 + (other.y-u.y)**2;
        if (d < closest || (d === closest && (!mouse || other.id < mouse.id))) {
          mouse = other; closest = d;
        }
      }
      if (mouse) { mice.set(u.id, mouse.id); disable(u.id, 14); }
    }
    if (u.kind !== "kirin" || tick < u.nextAttackTick) continue;
    let target: Target | undefined = nearestEnemy(u, targets);
    if (!target || !within(u, target, storm.reach + (target.kind === "base" ? BASE_RADIUS : 0))) continue;
    const path = [{x: u.x, y: u.y}], visited = new Set<number>();
    for (const amount of [storm.damage, 7, 5, 3]) {
      if (!target) break;
      hit(target, amount, u.team);
      disable(target.id, storm.stunTicks);
      path.push({x: target.x, y: target.y});
      visited.add(target.id);
      const conductive: boolean = target.kind === "base" || target.kind === "shieldbearer" || isMachine(target.kind);
      target = nearestEnemy({team: u.team, ...path[path.length - 1]}, targets.filter(t => !visited.has(t.id)), conductive ? storm.metalRange : storm.jumpRange);
    }
    arcs.set(u.id, {tick, path});
  }

  const ready = units.filter(u => u.hp > 0 && u.windup && tick >= (u.stunnedUntil ?? 0) &&
    tick - u.windup.since >= (u.windup.kind === "smash" ? club.windup : club.swallowTicks));
  ready.sort((a, b) => a.windup!.since - b.windup!.since || a.id - b.id);
  for (const caster of ready) {
    const swing = caster.windup!;
    if (swing.kind !== "smash" || stuns.has(caster.id)) continue;
    finished.add(caster.id);
    effects.push({kind: "smash", team: caster.team, x: swing.x, y: swing.y, tick, radius: club.blastRadius});
    for (const target of targets) {
      const base = target.kind === "base";
      if (target.team === caster.team || target.hp <= 0 || !within(swing, target, club.blastRadius + (base ? BASE_RADIUS : 0))) continue;
      hit(target, base ? 10 : club.damage, caster.team);
      disable(target.id, club.stunTicks);
      if (!base) {
        const list = shocks.get(target.id) ?? [];
        list.push(swing);
        shocks.set(target.id, list);
      }
    }
  }
  for (const caster of ready) {
    const swing = caster.windup!;
    if (swing.kind !== "swallow" || stuns.has(caster.id)) continue;
    finished.add(caster.id);
    const meal = units.find(u => u.id === swing.targetId);
    if (!meal || swallowed.has(meal.id) || meal.team === caster.team || !isHuman(meal.kind) ||
        meal.hp <= 0 || meal.hp > club.swallowHp || !within(caster, meal, club.swallowRange + 3)) continue;
    meals.set(caster.id, meal);
    swallowed.add(meal.id);
    hit(meal, meal.hp, caster.team);
  }
  return {stuns, arcs, mice, finished, shocks, meals, swallowed};
}

export function finishBuilding(unit: Unit, tick: number): Placement | undefined {
  const workshop = unit.kind === "workshop";
  if ((!workshop && unit.kind !== "engineer") || unit.constructingSince === undefined || unit.hp <= 0) return;
  if (!workshop && unit.lastHitTick === tick) { delete unit.constructingSince; return; }
  const windup = workshop ? UNIT_DEFINITIONS.workshop.windup : UNIT_DEFINITIONS.engineer.buildTicks;
  if (tick - unit.constructingSince < windup) return;
  const index = (unit.builtCount ?? 0) + 1;
  unit.builtCount = index; unit.lastSpawnTick = tick;
  delete unit.constructingSince;
  // Player-issued IDs are positive and bases occupy -1 through -4.
  // Each original builder has four reserved slots, independent of packet order.
  const id = -1024 - unit.id * 4 - index;
  const spread = workshop ? (index - 2) * 9 : 0;
  // Build to the side so an Engineer can shelter behind their own post.
  const side = unit.y > ARENA.height / 2 ? -1 : 1;
  return { id, team: unit.team, kind: workshop ? "mouse" : "post", x: unit.x + unit.aimX * 17,
    y: unit.y + unit.aimY * 17 + (workshop ? spread : side * 19), makerId: unit.id };
}
