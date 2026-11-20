import { projectileContacts, type Arrow } from "./arrows.ts";
import { ARENA, BASE_RADIUS } from "./battlefield.ts";
import { afflict, slow, type GroundEffect, type Hit } from "./conditions.ts";
import { facesShot } from "./defense.ts";
import type { Target, Unit } from "./simulation.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

export function releaseShot(unit: Unit, target: Target, tick: number, tickRate: number): Arrow {
  const spec = UNIT_DEFINITIONS[unit.kind];
  if (spec.attack !== "arrow") throw new Error("This unit has no projectile.");
  const speed = spec.arrowSpeed / tickRate;
  const shot: Arrow = {team: unit.team, x: unit.x, y: unit.y, vx: unit.aimX * speed, vy: unit.aimY * speed, damage: spec.damage, releasedTick: tick};
  switch (unit.kind) {
    case "bomber": {
      const dx = target.x - unit.x, dy = target.y - unit.y;
      const flight = Math.max(15, Math.ceil(Math.hypot(dx, dy) / speed));
      return {...shot, kind: "bomb", landTick: tick + flight, vx: dx / flight, vy: dy / flight};
    }
    case "musketeer": return {...shot, kind: "bullet"};
    case "scout": return {...shot, kind: "venom"};
    case "frostqueen": return {...shot, kind: "ice"};
    case "post": case "drone": return {...shot, kind: "dart"};
    default: return shot;
  }
}

function splash(shot: Arrow, x: number, y: number, tick: number, targets: readonly Target[], hit: Hit, effects: GroundEffect[]) {
  const ice = shot.kind === "ice";
  const radius = ice ? UNIT_DEFINITIONS.frostqueen.frostRadius : UNIT_DEFINITIONS.bomber.blastRadius;
  effects.push({kind: ice ? "frost" : "blast", x, y, tick, radius, team: shot.team});
  for (const target of targets) {
    if (target.hp <= 0 || target.team === shot.team || Math.hypot(x-target.x, y-target.y) > radius + (target.kind === "base" ? BASE_RADIUS : 0)) continue;
    hit(target, target.kind === "base" ? Math.ceil(shot.damage / 2) : shot.damage, shot.team);
    if (ice && target.kind !== "base") slow(target, tick + UNIT_DEFINITIONS.frostqueen.slowTicks);
  }
}

export function advanceShot(shot: Arrow, tick: number, from: readonly Target[], to: readonly Target[], byId: ReadonlyMap<number, Unit>,
  hit: Hit, effects: GroundEffect[]): Arrow | undefined {
  const x = shot.x + shot.vx, y = shot.y + shot.vy;
  if (shot.kind === "bomb") {
    if (tick >= shot.landTick!) { splash(shot, x, y, tick, to, hit, effects); return; }
    return {...shot, x, y};
  }
  let pierced = shot.piercedIds;
  for (const {target, time} of projectileContacts(shot, from, to)) {
    const body = byId.get(target.id);
    if (shot.kind === "ice") {
      splash(shot, shot.x + shot.vx * time, shot.y + shot.vy * time, tick, to, hit, effects);
      return;
    }
    const amount = pierced?.length ? UNIT_DEFINITIONS.musketeer.throughDamage : shot.damage;
    if (body?.kind === "shieldbearer" && facesShot(body, shot)) {
      body.lastBraceTick = body.lastBlockTick = tick;
      hit(target, Math.ceil(amount * UNIT_DEFINITIONS.shieldbearer.damageFraction), shot.team);
      return;
    }
    hit(target, amount, shot.team);
    if (body && shot.kind === "venom") afflict(body, "poison", shot.team, tick);
    if (shot.kind !== "bullet" || target.kind === "base" || pierced?.length) return;
    pierced = [target.id];
  }
  if (x >= 0 && x <= ARENA.width && y >= 0 && y <= ARENA.height) return pierced ? {...shot, x, y, piercedIds: pierced} : {...shot, x, y};
}
