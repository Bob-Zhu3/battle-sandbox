import { BASE_RADIUS } from "./battlefield.ts";
import { disabledUntil, type GroundEffect, type Hit } from "./conditions.ts";
import type { Target, Unit } from "./simulation.ts";
import { exposed, nearestEnemy } from "./targeting.ts";
import { hasSoul } from "./transformations.ts";
import { footprint, isBuilding, UNIT_DEFINITIONS as defs } from "./units.ts";

export interface Impulse { id: number; dx: number; dy: number }
type Point = {x: number; y: number};
const distance = (a: Point,b: Point) => Math.hypot(a.x-b.x,a.y-b.y);
const mobile = (target: Target): target is Unit => target.kind !== "base" && !isBuilding(target.kind) && target.emberUntil === undefined;
const enemies = (u: Unit, targets: readonly Target[], range: number) => targets.filter(t =>
  t.team !== u.team && exposed(t) && distance(u,t) <= range+(t.kind === "base" ? BASE_RADIUS : 0)
).sort((a,b)=>distance(u,a)-distance(u,b) || a.id-b.id);

function pushToward(impulses: Impulse[], target: Target, point: Point, limit: number) {
  if (!mobile(target)) return;
  const dx=point.x-target.x, dy=point.y-target.y, length=Math.hypot(dx,dy);
  if (!length) return;
  const factor=Math.min(1,limit/length);
  impulses.push({id:target.id,dx:dx*factor,dy:dy*factor});
}

export function rosterTarget(u: Unit, targets: readonly Target[]) {
  if (u.kind === "trojanhorse" && u.openedTick === undefined) {
    const structures=targets.filter(t=>t.kind === "base" || isBuilding(t.kind));
    return nearestEnemy(u,structures,140);
  }
  if (u.kind !== "sandworm") return;
  let loudest: Unit | undefined, best=0, closest=Infinity;
  for (const t of targets) {
    if (t.kind === "base" || t.team === u.team || !exposed(t) || t.pace < .15) continue;
    const d=distance(u,t);
    if (d>150) continue;
    const weight=footprint(t);
    if (weight>best || (weight===best && (d<closest || (d===closest && t.id<loudest!.id)))) {
      loudest=t; best=weight; closest=d;
    }
  }
  return loudest;
}

export function startTelegraph(u: Unit, target: Target, tick: number) {
  const kind=defs[u.kind].attack;
  if (kind !== "gaze" && kind !== "breath" && kind !== "breach") return false;
  if (kind==="breach" && (u.rootedUntil ?? 0)>tick) return true;
  const reach=defs[u.kind].reach;
  const x=kind==="breach" ? target.x : u.x+u.aimX*reach;
  const y=kind==="breach" ? target.y : u.y+u.aimY*reach;
  u.windup={kind,since:tick,x,y,targetId:target.id};
  return true;
}

function inCone(u: Unit, t: Target, range: number, width: number) {
  const dx=t.x-u.x,dy=t.y-u.y;
  const ahead=dx*u.aimX+dy*u.aimY, across=Math.abs(dx*u.aimY-dy*u.aimX);
  const edge=t.kind==="base" ? BASE_RADIUS : footprint(t);
  return ahead>=-edge*.3 && ahead<=range+edge && across<=edge*.65+Math.max(0,ahead)*width/range;
}

// A completed gaze interrupts attacks before movement. Equal-time gazes use stable caster IDs.
export function resolveGazes(units: readonly Unit[], targets: readonly Target[], tick: number, hit: Hit, effects: GroundEffect[], stuns: Map<number,number>) {
  const fired=new Set<number>(), stone=new Set<number>();
  const ready=units.filter(u=>u.kind==="medusa" && u.hp>0 && u.windup?.kind==="gaze" && tick-u.windup.since>=defs.medusa.windup);
  for (const u of ready.sort((a,b)=>a.windup!.since-b.windup!.since || a.id-b.id)) {
    if (disabledUntil(u)>tick || stuns.has(u.id)) continue;
    const end=u.windup!;
    fired.add(u.id);
    effects.push({kind:"gaze",fromX:u.x,fromY:u.y,x:end.x,y:end.y,radius:58,team:u.team,tick});
    for (const target of targets) {
      if (target.team===u.team || !exposed(target) || !inCone(u,target,defs.medusa.reach,58)) continue;
      hit(target,defs.medusa.damage,u.team);
      if (!mobile(target)) continue;
      const toward=(u.x-target.x)*target.aimX+(u.y-target.y)*target.aimY;
      if (toward < distance(u,target)*.25) continue;
      stuns.set(target.id,Math.max(stuns.get(target.id) ?? 0,tick+defs.medusa.stoneTicks));
      stone.add(target.id);
    }
  }
  return {fired,stone};
}

function finishSwing(u: Unit,tick: number) {
  delete u.windup;
  u.lastAttackTick=tick; u.nextAttackTick=tick+defs[u.kind].cooldownTicks;
  u.attackDirection={x:u.aimX,y:u.aimY};
}

export function releaseTelegraph(u: Unit, targets: readonly Target[], tick: number, gazeFired: boolean, hit: Hit,
  effects: GroundEffect[], burns: {id:number; team:Unit["team"]}[]) {
  const aim=u.windup;
  if (!aim) return;
  if (aim.kind==="gaze") { if (gazeFired) finishSwing(u,tick); return; }
  if (aim.kind==="breath") {
    if (tick-aim.since<defs.firedragon.windup) return;
    effects.push({kind:"breath",fromX:u.x,fromY:u.y,x:aim.x,y:aim.y,radius:45,tick,team:u.team});
    for (const t of targets) {
      if (t.team===u.team || !exposed(t) || !inCone(u,t,defs.firedragon.reach,45)) continue;
      hit(t,defs.firedragon.damage,u.team);
      if (t.kind!=="base") burns.push({id:t.id,team:u.team});
    }
  } else return;
  finishSwing(u,tick);
}

export function eruptWorm(u: Unit, targets: readonly Target[], tick: number, hit: Hit, effects: GroundEffect[], impulses: Impulse[]) {
  effects.push({kind:"breach",x:u.x,y:u.y,radius:defs.sandworm.blastRadius,tick,team:u.team});
  for (const t of enemies(u,targets,defs.sandworm.blastRadius)) {
    hit(t,defs.sandworm.damage,u.team);
    if (mobile(t)) {
      const dx=t.x-u.x,dy=t.y-u.y,len=Math.hypot(dx,dy);
      impulses.push({id:t.id,dx:len?dx/len*14:u.aimX*14,dy:len?dy/len*14:u.aimY*14});
    }
  }
  finishSwing(u,tick);
}

// The fist sweeps a short segment from the Monk toward his original aim.
// Each beat samples the live footprints, so enemies can enter or leave the lane.
function punch(u: Unit, targets: readonly Target[], tick: number, hit: Hit) {
  const spec=defs.monk;
  u.lastAttackTick=tick;
  for (const target of targets) {
    if (target.team===u.team || !exposed(target)) continue;
    const dx=target.x-u.x, dy=target.y-u.y, ahead=dx*u.aimX+dy*u.aimY;
    if (ahead<0) continue;
    const along=Math.min(ahead,spec.reach);
    const x=dx-along*u.aimX, y=dy-along*u.aimY;
    const radius=spec.fistRadius+(target.kind==="base" ? BASE_RADIUS : footprint(target));
    if (x*x+y*y<=radius*radius) hit(target,spec.damage,u.team);
  }
}

export function continueFlurry(u: Unit, targets: readonly Target[], tick: number, hit: Hit) {
  if (u.flurryStartedTick===undefined) return false;
  const age=tick-u.flurryStartedTick, spec=defs.monk;
  if (age>=spec.punchCount*spec.punchGap) {
    delete u.flurryStartedTick;
    return false;
  }
  if (age%spec.punchGap===0) punch(u,targets,tick,hit);
  return true;
}

// Secondary hits use the same opening positions and damage ledger as ordinary melee.
export function rosterStrike(u: Unit, primary: Target, targets: readonly Target[], tick: number, hit: Hit,
  healing: Map<number,number>, impulses: Impulse[]) {
  const spec=defs[u.kind];
  const damage=(t: Target,amount: number)=>hit(t,amount,u.team);
  switch (u.kind) {
    case "monk":
      u.flurryStartedTick=tick;
      punch(u,targets,tick,hit);
      break;
    case "liondancers": {
      damage(primary,spec.damage);
      const rear=enemies(u,targets,spec.reach).find(t=>t.id!==primary.id && (t.x-u.x)*u.aimX+(t.y-u.y)*u.aimY<0);
      if (rear) {
        damage(rear,defs.liondancers.kickDamage); u.lastKickTick=tick;
        if (mobile(rear)) impulses.push({id:rear.id,dx:-u.aimX*16,dy:-u.aimY*16});
      }
      break;
    }
    case "rhinorider": {
      const charged=(u.runUp ?? 0)>=defs.rhinorider.runUp;
      damage(primary,spec.damage+(charged ? defs.rhinorider.bonus : 0));
      if (charged) {
        u.runUp=0; u.lastChargeTick=tick;
        for (const t of enemies(u,targets,spec.reach+9)) {
          if (!mobile(t) || !inCone(u,t,spec.reach+9,22)) continue;
          if (t.id!==primary.id) damage(t,5);
          impulses.push({id:t.id,dx:u.aimX*defs.rhinorider.shove,dy:u.aimY*defs.rhinorider.shove});
        }
      }
      break;
    }
    case "hydra": case "cerberus": {
      const hydra=u.kind==="hydra", heads=hydra?(u.heads ?? 2):3;
      const others=enemies(u,targets,spec.reach).filter(t=>t.id!==primary.id).slice(0,heads-1);
      damage(primary,spec.damage+(hydra ? (heads-1-others.length)*2 : 0));
      for (const t of others) damage(t,hydra ? spec.damage : defs.cerberus.sideDamage);
      break;
    }
    case "kraken": {
      damage(primary,spec.damage);
      const other=mobile(primary) ? enemies(u,targets,spec.reach).find(t=>t.id!==primary.id && mobile(t)) : undefined;
      const gripped=other ? [primary,other] : [primary];
      u.grab={tick,targets:gripped.map(({id,x,y})=>({id,x,y}))};
      if (other) {
        damage(other,spec.damage);
        const middle={x:(other.x+primary.x)/2,y:(other.y+primary.y)/2};
        pushToward(impulses,primary,middle,defs.kraken.grip); pushToward(impulses,other,middle,defs.kraken.grip);
      } else pushToward(impulses,primary,u,defs.kraken.grip);
      break;
    }
    case "vampire":
      damage(primary,spec.damage);
      if (hasSoul(primary)) {
        healing.set(u.id,(healing.get(u.id) ?? 0)+Math.min(defs.vampire.drain,primary.hp));
        u.lastHealTick=tick;
      }
      break;
    case "werewolf": {
      const transformed=(u.wolfUntil ?? 0)>tick;
      damage(primary,transformed ? defs.werewolf.clawDamage : spec.damage);
      if (transformed) u.nextAttackTick=tick+defs.werewolf.clawTicks;
      break;
    }
    case "irongolem":
      damage(primary,spec.damage);
      if (mobile(primary)) impulses.push({id:primary.id,dx:u.aimX*22,dy:u.aimY*22});
      break;
    case "slime":
      damage(primary,u.smallSlime ? 4 : spec.damage);
      break;
    default: return false;
  }
  return true;
}
