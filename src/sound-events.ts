import type { World } from "./room-protocol.ts";
import type { Unit } from "./simulation.ts";
import { SPELLS } from "./spells.ts";
import { isBuilding, type UnitKind } from "./units.ts";

// In a crowd, reserve space for a voice, a material and a spell to be heard together.
const mix = {
  glass:["material",.20], lightning:["spell",.24], freeze:["spell",.22], rage:["spell",.28],
  impact:["spell",.21], fall:["spell",.19], howl:["voice",.90], charge:["voice",.55], roar:["voice",.85],
  screech:["voice",.62], groan:["voice",.62], whisper:["voice",.65], squeal:["voice",.36], squeak:["voice",.32],
  block:["material",.16], clash:["weapon",.18], toll:["material",.29], reflect:["material",.10],
  fault:["spell",.21], briar:["spell",.16], mirror:["spell",.18], lens:["weapon",.14],
  sling:["weapon",.17], thunder:["spell",.19], smash:["material",.18], shot:["weapon",.12],
  bowDraw:["draw",.15], bow:["weapon",.095], bolt:["weapon",.11], toss:["weapon",.23], fuse:["weapon",.22],
  shard:["weapon",.16], dart:["weapon",.15], hex:["weapon",.25], wood:["material",.16], metal:["material",.15],
  beastHurt:["hurt",.26], birdHurt:["hurt",.29], hit:["hurt",.20], rain:["spell",.21], gust:["spell",.21], place:["brush",.09],
} as const;
export type CueKind = keyof typeof mix;
type Lane = (typeof mix)[CueKind][0];
export interface Cue { kind: CueKind; x: number; seed: number }
const laneGap: Record<Lane,number> = {spell:.075,material:.066,weapon:.068,voice:.28,hurt:.18,draw:.13,brush:.085};
export function createCueMixer() {
  const lastKind=new Map<CueKind,number>(), lastLane=new Map<Lane,number>();
  return (cues: readonly Cue[], now: number) => {
    const result: Cue[]=[];
    for (const cue of cues) {
      const [lane,gap]=mix[cue.kind];
      if (now-(lastKind.get(cue.kind)??-Infinity)<gap || now-(lastLane.get(lane)??-Infinity)<laneGap[lane]) continue;
      lastKind.set(cue.kind,now);lastLane.set(lane,now);result.push(cue);
      if (result.length===4) break;
    }
    return result;
  };
}

const attacks: Partial<Record<UnitKind,CueKind>> = {archer:"bow",post:"bolt",lobber:"sling",musketeer:"shot",scout:"dart",clown:"toss",bomber:"fuse",
  frostqueen:"shard",witch:"hex",warrior:"clash",shieldbearer:"clash",belltower:"toll",phoenix:"screech",zombie:"groan"};
function hurtVoice(u: Unit): CueKind {
  if(isBuilding(u.kind)) return u.kind==="sunlens"?"metal":"wood";
  if(u.kind==="drone" || u.kind==="mouse") return "metal";
  if(u.kind==="phoenix") return "birdHurt";
  if(u.kind==="pig") return "squeal";
  if(u.kind==="kirin" || u.kind==="cyclops" || u.kind==="reaper" || u.kind==="zombie")return "beastHurt";
  return "hit";
}

export function battleCues(before: World | undefined, world: World): Cue[] {
  if (!before || world === before || world.tick < before.tick || world.tick-before.tick>12) return [];
  const groups = new Map<CueKind,{sum:number;count:number;seed:number}>();
  function add(kind: CueKind,x: number,id: number,tick=world.tick) {
    const variation=(Math.imul(id,31)+tick*13)>>>0;
    // Each human keeps their voice across hits, with two takes from the same performer.
    const seed=kind==="hit" ? ((variation & ~1) | (id & 1))>>>0 : variation;
    const group=groups.get(kind);
    if(group){group.sum+=x;group.count++;group.seed=Math.min(seed,group.seed);}
    else groups.set(kind,{sum:x,count:1,seed});
  }
  const fresh=(tick: number|null|undefined): tick is number => tick!=null && tick>before.tick && tick<=world.tick;
  for (const s of world.spells??[]) {
    const kind=s.kind, pulse=s.startTick+SPELLS[kind].delay;
    if(kind==="meteor" || kind==="rain" || kind==="gust") {
      if(s.startTick>=before.tick && !before.spells?.some(old=>old.id===s.id)) add(kind==="meteor"?"fall":kind,s.x,s.id,s.startTick);
      if(kind==="meteor" && fresh(pulse)) add("impact",s.x,s.id,pulse);
    } else if (fresh(pulse)) add(kind,s.x,s.id,pulse);
    if(kind==="fault" && fresh(s.startTick+SPELLS.fault.aftershock))add("fault",s.x,s.id,s.startTick+SPELLS.fault.aftershock);
    if(s.reflection && fresh(s.reflection.tick))add("reflect",s.reflection.x,s.id,s.reflection.tick);
  }
  if (world.units!==before.units) {
    const previous=new Map(before.units.map(u=>[u.id,u]));
    for (const u of world.units) {
      const old=previous.get(u.id);
      if(!old)add("place",u.x,u.id);
      if(fresh(u.lastBlockTick))add("block",u.x,u.id,u.lastBlockTick);
      else if(fresh(u.lastHitTick) && (!world.bases || u.hp || u.killedBy!==undefined))add(hurtVoice(u),u.x,u.id,u.lastHitTick);
      if(fresh(u.lastChargeReadyTick))add("charge",u.x,u.id,u.lastChargeReadyTick);
      if(fresh(u.lastDrawTick))add("bowDraw",u.x,u.id,u.lastDrawTick);
      if(u.windup?.kind==="smash" && fresh(u.windup.since))add("roar",u.x,u.id,u.windup.since);
      if(fresh(u.lastSmashTick))add("smash",u.x,u.id,u.lastSmashTick);
      if(fresh(u.lastSqueakTick))add("squeak",u.x,u.id,u.lastSqueakTick);
      if(fresh(u.lastHatchTick))add("screech",u.x,u.id,u.lastHatchTick);
      if(u.soul && fresh(u.soul.tick))add("whisper",u.x,u.id,u.soul.tick);
      if(u.zombified && fresh(u.zombified.tick))add("groan",u.x,u.id,u.zombified.tick);
      if(u.hex && fresh(u.hex.since))add("squeal",u.x,u.id,u.hex.since);
      if(u.beam && fresh(u.beam.tick))add("lens",u.x,u.id,u.beam.tick);
      if(u.arc && fresh(u.arc.tick)){add("howl",u.x,u.id,u.arc.tick);add("thunder",u.x,u.id,u.arc.tick);}
      if(!fresh(u.lastAttackTick))continue;
      const sound=attacks[u.kind];
      if(sound)add(sound,u.x,u.id,u.lastAttackTick);
    }
  }
  for(const b of world.bases??[]){
    if(fresh(b.lastHitTick))add("wood",b.x,b.id,b.lastHitTick);
    if(fresh(b.lastShotTick))add("bolt",b.x,b.id,b.lastShotTick);
  }
  // A drone has three separate releases. Reflections have their own glass cue.
  for(const a of world.arrows) if(a.kind==="dart" && a.reflectedTick===undefined && fresh(a.releasedTick) &&
    world.units.some(u=>u.id===a.casterId && u.kind==="drone")) add("bolt",a.x,a.casterId!,a.releasedTick);
  for(const e of world.effects??[]) if(fresh(e.tick)) {
    if(e.kind==="glass")add("glass",e.x,Math.round(e.y),e.tick);
    if(e.kind==="stonefall" || e.kind==="blast")add("smash",e.x,Math.round(e.y),e.tick);
  }
  return (Object.keys(mix) as CueKind[]).flatMap(kind=>{
    const g=groups.get(kind);return g?[{kind,x:g.sum/g.count,seed:g.seed}]:[];
  });
}
