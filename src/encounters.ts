import type { Arrow } from "./arrows.ts";
import { ARENA, ARMIES } from "./battlefield.ts";
import type { Unit, Target, Placement } from "./simulation.ts";
import { nearestEnemy } from "./targeting.ts";
import { isMachine, UNIT_DEFINITIONS } from "./units.ts";

type Hit = (target: Target, amount: number, team: Unit["team"]) => void;

export function giantTurn(giant: Unit, units: readonly Unit[], tick: number, shots: Arrow[], tickRate: number) {
  const spec = UNIT_DEFINITIONS.giant;
  const range = spec.fearRange + (giant.fearId !== undefined ? 16 : 0);
  let mouse: Unit | undefined, closest = range ** 2;
  for (const other of units) {
    if (other.kind !== "mouse" || other.hp <= 0) continue;
    const d = (giant.x - other.x) ** 2 + (giant.y - other.y) ** 2;
    if (d < closest || (d === closest && (!mouse || other.id < mouse.id))) { mouse = other; closest = d; }
  }
  if (mouse) {
    giant.fearId = giant.targetId = mouse.id;
    if (giant.barrel) {
      giant.droppedBarrel = { x: giant.x, y: giant.y, tick, side: giant.aimX < 0 ? -1 : 1 };
      delete giant.barrel;
    }
    giant.frightUntil = tick + spec.fleeTicks;
  }
  if (mouse || tick < (giant.frightUntil ?? 0)) {
    let dx = mouse ? giant.x - mouse.x : giant.aimX;
    let dy = mouse ? giant.y - mouse.y : giant.aimY;
    if (!dx && !dy) dx = ARMIES[giant.team].facing;
    // At a wall, run along it. A frightened Giant can get round a corner.
    if ((giant.x <= spec.radius + 2 && dx < 0) || (giant.x >= ARENA.width - spec.radius - 2 && dx > 0)) { dx = 0; dy ||= giant.y < ARENA.height / 2 ? 1 : -1; }
    if ((giant.y <= spec.radius + 2 && dy < 0) || (giant.y >= ARENA.height - spec.radius - 2 && dy > 0)) { dy = 0; dx ||= giant.x < ARENA.width / 2 ? 1 : -1; }
    const distance = Math.hypot(dx, dy) || 1;
    giant.aimX = dx / distance; giant.aimY = dy / distance;
    giant.x += giant.aimX * spec.speed / tickRate; giant.y += giant.aimY * spec.speed / tickRate;
    return true;
  }
  delete giant.fearId;
  delete giant.frightUntil;
  const held = giant.barrel;
  if (!held) return false;
  giant.aimX = held.dx; giant.aimY = held.dy;
  if (tick - held.since >= spec.holdTicks) {
    const speed = UNIT_DEFINITIONS.cooper.arrowSpeed / tickRate;
    shots.push({ kind: "barrel", returned: true, team: giant.team, x: giant.x, y: giant.y,
      vx: held.dx * speed, vy: held.dy * speed, damage: held.damage, releasedTick: tick });
    giant.lastAttackTick = tick;
    giant.attackDirection = {x: held.dx, y: held.dy};
    delete giant.barrel;
  }
  return true;
}

export function catchBarrel(giant: Unit, shot: Arrow, tick: number) {
  if (shot.kind !== "barrel" || shot.returned || giant.barrel || giant.fearId !== undefined) return false;
  const speed = Math.hypot(shot.vx, shot.vy) || 1;
  if (giant.aimX * shot.vx + giant.aimY * shot.vy > -0.15 * speed) return false;
  giant.barrel = { since: tick, dx: -shot.vx / speed, dy: -shot.vy / speed, damage: shot.damage };
  return true;
}

export function chainLightning(caster: Unit, first: Target, units: readonly Unit[], tick: number, hit: Hit) {
  const path = [{ x: caster.x, y: caster.y }];
  const visited = new Set<number>();
  let target: Target | undefined = first;
  for (const amount of [UNIT_DEFINITIONS.kirin.damage, 5, 3]) {
    if (!target) break;
    path.push({ x: target.x, y: target.y });
    hit(target, amount, caster.team);
    visited.add(target.id);
    if (target.kind === "base") break;
    const reach: number = isMachine(target.kind) || target.kind === "shieldbearer" ? 82 : 38;
    target = nearestEnemy({ ...path.at(-1)!, team: caster.team }, units.filter(u => !visited.has(u.id)), reach);
  }
  caster.arc = {tick, path};
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
