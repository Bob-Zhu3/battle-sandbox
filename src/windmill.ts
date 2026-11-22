import { BASE_RADIUS } from "./battlefield.ts";
import { type Arrow } from "./arrows.ts";
import type { Hit } from "./conditions.ts";
import type { Impulse } from "./roster-attacks.ts";
import type { Target, Unit } from "./simulation.ts";
import { exposed } from "./targeting.ts";
import { isBuilding, UNIT_DEFINITIONS } from "./units.ts";

const fan=UNIT_DEFINITIONS.windmill;

// Clip a moving point against the four edges of the fan's widening stream.
// For a standing body, the same test with zero velocity is a point-in-cone check.
function windEntry(mill: Unit, x: number, y: number, vx=0, vy=0, padding=0) {
  const dx=x-mill.x,dy=y-mill.y;
  const ahead=dx*mill.aimX+dy*mill.aimY, across=dy*mill.aimX-dx*mill.aimY;
  const along=vx*mill.aimX+vy*mill.aimY, sideways=vy*mill.aimX-vx*mill.aimY;
  const halfWidth=4+fan.spread*ahead;
  let enter=0,leave=1;
  function clip(start: number, change: number) {
    if (change===0) return start>=0;
    const crossing=-start/change;
    if (change>0) enter=Math.max(enter,crossing); else leave=Math.min(leave,crossing);
    return enter<=leave;
  }
  if (clip(ahead+padding,along) && clip(fan.reach+padding-ahead,-along) &&
      clip(halfWidth+padding-across,fan.spread*along-sideways) &&
      clip(halfWidth+padding+across,fan.spread*along+sideways)) return enter;
}

export function blowFan(mill: Unit, target: Target | undefined, targets: readonly Target[], tick: number, tickRate: number, hit: Hit, impulses: Impulse[]) {
  mill.targetId=target?.id ?? null;
  if (target) {
    const dx=target.x-mill.x,dy=target.y-mill.y,d=Math.hypot(dx,dy);
    if (d) {mill.aimX=dx/d; mill.aimY=dy/d;}
  }
  const strong=(mill.millFastUntil ?? 0)>tick;
  const force=fan.pushPerSecond*(strong ? 1.8 : 1)/tickRate;
  const pulse=tick>=mill.nextAttackTick;
  let hitEnemy=false;
  for (const foe of targets) {
    if (foe.team===mill.team || !exposed(foe) || windEntry(mill,foe.x,foe.y,0,0,foe.kind==="base" ? BASE_RADIUS : 0)===undefined) continue;
    if (foe.kind!=="base" && !isBuilding(foe.kind) && foe.emberUntil===undefined) {
      impulses.push({id:foe.id,dx:force*mill.aimX,dy:force*mill.aimY});
    }
    if (pulse) {hit(foe,fan.damage,mill.team); hitEnemy=true;}
  }
  if (hitEnemy) {
    mill.lastAttackTick=tick; mill.nextAttackTick=tick+fan.cooldownTicks;
    mill.attackDirection={x:mill.aimX,y:mill.aimY};
  }
}

export interface FanContact {mill: Unit; time: number}
export function firstFanContact(shot: Arrow, mills: readonly Unit[]): FanContact | undefined {
  if (shot.kind && shot.kind!=="dart" && shot.kind!=="bolt" && shot.kind!=="venom") return;
  let first: FanContact | undefined;
  const speed=Math.hypot(shot.vx,shot.vy);
  for (const mill of mills) {
    if (mill.team===shot.team || shot.vx*mill.aimX+shot.vy*mill.aimY>=speed*.65) continue;
    const time=windEntry(mill,shot.x,shot.y,shot.vx,shot.vy);
    if (time!==undefined && (!first || time<first.time || (time===first.time && mill.id<first.mill.id))) first={mill,time};
  }
  return first;
}

export function turnDownwind(shot: Arrow, contact: FanContact, tick: number): Arrow {
  const {mill,time}=contact,speed=Math.hypot(shot.vx,shot.vy);
  mill.lastBlockTick=tick;
  return {...shot,x:shot.x+shot.vx*time,y:shot.y+shot.vy*time,vx:mill.aimX*speed,vy:mill.aimY*speed,
    windTurn:{tick,fraction:time,vx:shot.vx,vy:shot.vy}};
}
