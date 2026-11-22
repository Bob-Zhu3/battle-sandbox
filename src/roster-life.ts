import { childId } from "./encounters.ts";
import type { Team } from "./battlefield.ts";
import type { Placement, Unit } from "./simulation.ts";
import { isMachine, UNIT_DEFINITIONS as defs } from "./units.ts";

interface Birth { placement: Placement; slime?: { hp: number; splitTick: number; siblingId: number } }

function child(parent: Unit, kind: "warrior" | "slime", slot: number, side: number): Placement {
  return {id:childId(parent.id,slot),team:parent.team,kind,makerId:parent.id,
    x:parent.x-parent.aimY*side, y:parent.y+parent.aimX*side};
}

export function settleTroopBodies(units: Unit[], byId: ReadonlyMap<number,Unit>, damage: ReadonlyMap<number,number>,
  fallen: ReadonlySet<Team>, tick: number): Birth[] {
  const births: Birth[]=[];
  const wrecks=units.filter(u=>!u.hp && u.lastHitTick===tick && isMachine(u.kind) && !fallen.has(u.team)).sort((a,b)=>a.id-b.id);
  const golems: Unit[]=[];
  for (const u of units) {
    if (fallen.has(u.team)) continue;
    const hurt=damage.get(u.id) ?? 0;
    if (u.kind==="trojanhorse" && u.openedTick===undefined && (u.lastAttackTick===tick || (!u.hp && u.lastHitTick===tick))) {
      u.openedTick=tick;
      births.push({placement:child(u,"warrior",1,-19)},{placement:child(u,"warrior",2,19)});
    }
    if (!u.hp) continue;
    if (u.kind==="hydra" && hurt) {
      const wounds=Number(u.hp*3<=defs.hydra.maxHp*2)+Number(u.hp*3<=defs.hydra.maxHp);
      const extra=wounds-(u.hydraWounds ?? 0);
      if (extra>0) {
        u.heads=Math.max(1,Math.min(4,(u.heads ?? 2)+(u.burn ? -extra : extra)));
        u.hydraWounds=wounds;
      }
    }
    if (u.kind==="werewolf" && hurt && tick>=(u.wolfReadyTick ?? 0)) {
      u.wolfUntil=tick+defs.werewolf.wolfTicks;
      u.wolfReadyTick=u.wolfUntil+defs.werewolf.restTicks;
    }
    if (u.kind==="irongolem" && u.hp<defs.irongolem.maxHp) {
      if (!u.spareUsed && u.hp*2<=defs.irongolem.maxHp) {
        u.spareUsed=true; u.hp+=defs.irongolem.repairHp; u.lastTreatedTick=tick;
      }
      if (wrecks.length && u.hp<defs.irongolem.maxHp) golems.push(u);
    }
    if (u.kind!=="slime") continue;
    if (u.splitTick===undefined && hurt>=defs.slime.splitDamage && u.hp>=2) {
      const part=child(u,"slime",1,16), shared=Math.floor(u.hp/2);
      u.hp-=shared; u.smallSlime=true; u.splitTick=tick; u.siblingId=part.id;
      births.push({placement:part,slime:{hp:shared,splitTick:tick,siblingId:u.id}});
    } else if (u.smallSlime && u.makerId===undefined && u.splitTick!==undefined && tick-u.splitTick>=defs.slime.mergeDelay) {
      const sibling=u.siblingId===undefined ? undefined : byId.get(u.siblingId);
      if (!sibling?.hp || sibling.kind!=="slime" || sibling.team!==u.team) { delete u.siblingId; continue; }
      if (Math.hypot(u.x-sibling.x,u.y-sibling.y)>20) continue;
      u.hp=Math.min(defs.slime.maxHp,u.hp+sibling.hp);
      delete u.smallSlime; delete u.siblingId; delete sibling.siblingId;
      sibling.hp=0; sibling.lastHitTick=null;
    }
  }
  for (const golem of golems.sort((a,b)=>a.id-b.id)) {
    const index=wrecks.findIndex(w=>Math.hypot(w.x-golem.x,w.y-golem.y)<=55);
    if (index<0) continue;
    wrecks.splice(index,1);
    golem.hp=Math.min(defs.irongolem.maxHp,golem.hp+defs.irongolem.repairHp); golem.lastTreatedTick=tick;
  }
  return births;
}
