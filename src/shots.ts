import { projectileContacts, type Arrow } from "./arrows.ts";
import { turnDownwind, type FanContact } from "./windmill.ts";
import { ARENA, BASE_RADIUS } from "./battlefield.ts";
import { afflict, displace, slow, type GroundEffect, type Hit } from "./conditions.ts";
import { canHex, type Conversion } from "./transformations.ts";
import { insideSpell, type FieldSpell } from "./spells.ts";
import { facesShot } from "./defense.ts";
import type { Target, Unit } from "./simulation.ts";
import { airborne, footprint, UNIT_DEFINITIONS } from "./units.ts";

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
    case "harpoon": return {...shot, kind:"harpoon"};
    case "snowman": return {...shot, kind:"snowball"};
    case "horseman": return {...shot,kind:"head",landTick:tick+Math.max(1,Math.ceil(Math.hypot(target.x-unit.x,target.y-unit.y)/speed))};
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
  if (gas) effects.push({kind:"glass",x,y,tick,radius:23,team:shot.team});
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

function dropHead(shot: Arrow, x: number, y: number, tick: number, byId: ReadonlyMap<number,Unit>) {
  const rider=shot.casterId===undefined ? undefined : byId.get(shot.casterId);
  if (rider?.kind!=="horseman" || !rider.hp || rider.team!==shot.team) return;
  rider.headSpot={x:Math.max(4,Math.min(ARENA.width-4,x)),y:Math.max(4,Math.min(ARENA.height-4,y))};
  rider.headLandedTick=tick;
}

export function deflectHead(shot: Arrow,winds: readonly FieldSpell[]): Arrow {
  if (shot.kind!=="head") return shot;
  const wind=winds.find(s=>s.team!==shot.team && insideSpell(s,shot));
  if (!wind) return shot;
  const dx=shot.x-wind.x,dy=shot.y-wind.y,d=Math.hypot(dx,dy),speed=Math.hypot(shot.vx,shot.vy);
  return {...shot,vx:d?dx/d*speed:-shot.vx,vy:d?dy/d*speed:-shot.vy};
}

export function advanceShot(shot: Arrow, tick: number, from: readonly Target[], to: readonly Target[], byId: ReadonlyMap<number, Unit>,
  hit: Hit, effects: GroundEffect[], conversions: Conversion[], fan?: FanContact): Arrow | undefined {
  const x = shot.x + shot.vx, y = shot.y + shot.vy;
  if (shot.kind === "bomb" || shot.kind === "balloon" || shot.kind === "stone") {
    if (tick >= shot.landTick!) { splash(shot, x, y, tick, to, hit, effects); return; }
    return {...shot, x, y};
  }
  let pierced = shot.piercedIds;
  const contacts=projectileContacts(shot,from,to);
  if (fan && fan.time<=(contacts[0]?.time ?? 1)) return turnDownwind(shot,fan,tick);
  for (const {target, time} of contacts) {
    const body = byId.get(target.id);
    if (shot.kind==="head") dropHead(shot,shot.x+shot.vx*time,shot.y+shot.vy*time,tick,byId);
    if (body && shot.kind==="snowball") slow(body,tick+UNIT_DEFINITIONS.snowman.slowTicks);
    if (body && shot.kind==="harpoon") {
      const tower=shot.casterId===undefined ? undefined : byId.get(shot.casterId);
      if (tower?.kind==="harpoon" && tower.hp>0 && tower.team===shot.team) {
        const dx=tower.x-body.x,dy=tower.y-body.y,d=Math.hypot(dx,dy);
        const pull=Math.min(UNIT_DEFINITIONS.harpoon.pull,Math.max(0,d-footprint(tower)-footprint(body)));
        if (d && pull) displace(body,dx/d*pull,dy/d*pull);
        if (airborne(body) || body.groundedUntil!==undefined) body.groundedUntil=tick+UNIT_DEFINITIONS.harpoon.groundTicks;
        effects.push({kind:"harpoon",team:shot.team,tick,x:body.x,y:body.y,fromX:tower.x,fromY:tower.y,radius:3});
      }
    }
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
  const inside=x>=0 && x<=ARENA.width && y>=0 && y<=ARENA.height;
  if (shot.kind==="head" && (tick>=(shot.landTick ?? tick) || !inside)) { dropHead(shot,x,y,tick,byId); return; }
  if (inside) return pierced ? {...shot, x, y, piercedIds: pierced} : {...shot, x, y};
}
