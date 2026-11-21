import { projectileContacts, type Arrow } from "./arrows.ts";
import { ARENA, BASE_RADIUS } from "./battlefield.ts";
import { afflict, slow, type GroundEffect, type Hit } from "./conditions.ts";
import { canHex, type Conversion } from "./transformations.ts";
import { insideSpell, type FieldSpell } from "./spells.ts";
import { facesShot } from "./defense.ts";
import type { Target, Unit } from "./simulation.ts";
import { airborne, UNIT_DEFINITIONS } from "./units.ts";

export function releaseShot(unit: Unit, target: Target, tick: number, tickRate: number): Arrow {
  const spec = UNIT_DEFINITIONS[unit.kind];
  if (spec.attack !== "arrow") throw new Error("This unit has no projectile.");
  const speed = spec.arrowSpeed / tickRate;
  const shot: Arrow = {team: unit.team, casterId: unit.id, x: unit.x, y: unit.y, vx: unit.aimX * speed, vy: unit.aimY * speed, damage: spec.damage, releasedTick: tick};
  switch (unit.kind) {
    case "lobber": case "clown": case "bomber": {
      const dx = target.x - unit.x, dy = target.y - unit.y;
      const flight = Math.max(15, Math.ceil(Math.hypot(dx, dy) / speed));
      return {...shot, kind: unit.kind === "lobber" ? "stone" : unit.kind === "clown" ? "balloon" : "bomb", landTick: tick + flight, vx: dx / flight, vy: dy / flight};
    }
    case "musketeer": return {...shot, kind: "bullet"};
    case "scout": return {...shot, kind: "venom"};
    case "witch": return {...shot, kind: "hex"};
    case "frostqueen": return {...shot, kind: "ice"};
    case "post": case "drone": return {...shot, kind: "dart"};
    default: return shot;
  }
}

function splash(shot: Arrow, x: number, y: number, tick: number, targets: readonly Target[], hit: Hit, effects: GroundEffect[]) {
  const ice = shot.kind === "ice", gas = shot.kind === "balloon", stone = shot.kind === "stone";
  const radius = stone ? UNIT_DEFINITIONS.lobber.blastRadius : gas ? UNIT_DEFINITIONS.clown.cloudRadius : ice ? UNIT_DEFINITIONS.frostqueen.frostRadius : UNIT_DEFINITIONS.bomber.blastRadius;
  effects.push({kind: stone ? "stonefall" : gas ? "miasma" : ice ? "frost" : "blast", x, y, tick, radius, team: shot.team});
  for (const target of targets) {
    if (target.hp <= 0 || (target.kind !== "base" && target.tunnel) || target.team === shot.team || Math.hypot(x-target.x, y-target.y) > radius + (target.kind === "base" ? BASE_RADIUS : 0)) continue;
    if (stone && airborne(target)) continue;
    hit(target, target.kind === "base" ? Math.ceil(shot.damage / 2) : shot.damage, shot.team);
    if (ice && target.kind !== "base") slow(target, tick + UNIT_DEFINITIONS.frostqueen.slowTicks);
  }
}

export function applyClouds(effects: GroundEffect[], units: Unit[], winds: readonly FieldSpell[], tick: number) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const cloud = effects[i];
    if (cloud.kind !== "miasma") continue;
    if (winds.some(wind => wind.team !== cloud.team && insideSpell(wind, cloud))) { effects.splice(i,1); continue; }
    if ((tick - cloud.tick) % UNIT_DEFINITIONS.clown.puffEvery) continue;
    for (const unit of units) {
      if (!unit.tunnel && unit.team !== cloud.team && Math.hypot(unit.x-cloud.x,unit.y-cloud.y) <= cloud.radius)
        afflict(unit,"poison",cloud.team,tick);
    }
  }
}

export function advanceShot(shot: Arrow, tick: number, from: readonly Target[], to: readonly Target[], byId: ReadonlyMap<number, Unit>,
  hit: Hit, effects: GroundEffect[], conversions: Conversion[]): Arrow | undefined {
  const x = shot.x + shot.vx, y = shot.y + shot.vy;
  if (shot.kind === "bomb" || shot.kind === "balloon" || shot.kind === "stone") {
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
    if (shot.kind === "hex") {
      if (canHex(target)) conversions.push({id: target.id, casterId: shot.casterId!, team: shot.team, kind: "hex"});
      else hit(target, shot.damage, shot.team);
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
