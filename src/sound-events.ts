import type { Snapshot, World } from "./room-protocol.ts";
import { ARENA, type Team } from "./battlefield.ts";
import type { Unit } from "./simulation.ts";
import { SPELLS, type SpellKind, type FieldSpell } from "./spells.ts";
import { prismLevel } from "./siege.ts";
import { isBuilding, UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

// In a crowd, reserve space for a voice, a material and a spell to be heard together.
const mix = {
  ready:["signal",.16], count:["signal",.23], march:["signal",.36],
  victory:["signal",.50], defeat:["signal",.50], stalemate:["signal",.50],
  // Deliberate placement and one-off transformations should survive a busy tick.
  place:["brush",.09], spellSet:["brush",.10], keepFall:["spell",.42], rebirth:["spell",.38], gulp:["voice",.36],
  wormhole:["spell",.27], portalOpen:["spell",.22], prism:["weapon",.47], stoneGaze:["spell",.24], fireBreath:["weapon",.44],
  winch:["weapon",.27], hook:["material",.19], breach:["material",.37], snow:["weapon",.16], squelch:["material",.18],
  cymbals:["material",.23], punch:["weapon",.09], snort:["voice",.49], hiss:["voice",.42], bark:["voice",.48],
  splash:["material",.22], flutter:["weapon",.23], fan:["material",.25], hatch:["material",.32], anvil:["material",.34],
  glass:["material",.20], lightning:["spell",.24], freeze:["spell",.22], rage:["spell",.28],
  impact:["spell",.21], fall:["spell",.19], howl:["voice",.90], charge:["voice",.55], roar:["voice",.85],
  bandage:["material",.27], repair:["material",.27], raisePost:["material",.32], windKey:["material",.30],
  breakSoil:["material",.22], burrow:["material",.32], slimeSplit:["material",.29], soulCatch:["spell",.31],
  kirinCall:["voice",.46], inhale:["voice",.40], boulderLand:["material",.23], bombBlast:["material",.25],
  pumpkinLand:["material",.23], frostLand:["material",.21], facet:["weapon",.18], sails:["material",.38],
  hornCrash:["material",.30], hornJab:["weapon",.17], timberRam:["weapon",.23], pumpkinThrow:["weapon",.22],
  shieldBash:["weapon",.17], thrust:["weapon",.16], staff:["weapon",.13], pickaxe:["weapon",.18], scythe:["weapon",.18],
  clockBite:["weapon",.12], wrench:["weapon",.15], wolfClaw:["weapon",.15], traveler:["weapon",.16],
  pigButt:["weapon",.20], droneBolt:["weapon",.08], keepBolt:["weapon",.20], bite:["weapon",.17],
  screech:["voice",.62], groan:["voice",.62], whisper:["voice",.65], squeal:["voice",.36], squeak:["voice",.32],
  block:["material",.16], clash:["weapon",.18], toll:["material",.29], reflect:["material",.10],
  fault:["spell",.21], briar:["spell",.16], mirror:["spell",.18], lens:["weapon",.14],
  sling:["weapon",.17], thunder:["spell",.19], smash:["material",.18], shot:["weapon",.12],
  bowDraw:["draw",.15], bow:["weapon",.095], bolt:["weapon",.11], toss:["weapon",.23], fuse:["weapon",.22],
  shard:["weapon",.16], dart:["weapon",.15], hex:["weapon",.25], wood:["material",.16], metal:["material",.15],
  beastHurt:["hurt",.34], birdHurt:["hurt",.36], hit:["hurt",.31], rain:["spell",.21], gust:["spell",.21],
  kindle:["material",.27], venom:["material",.31],
  backKick:["weapon",.16], drain:["spell",.24], regrow:["voice",.36], fuseSlime:["material",.28],
  rivet:["material",.25], packSnow:["material",.28],
} as const;
export type CueKind = keyof typeof mix;
type Lane = (typeof mix)[CueKind][0];
export interface Cue { kind: CueKind; x: number; seed: number; unit?: UnitKind; spell?: SpellKind; level?: number; chain?: readonly number[]; beat?: number }
const priority = new Map(Object.keys(mix).map((kind,i) => [kind,i]));
const identity=(c: Cue) => c.kind+"."+(c.unit ?? c.spell ?? "");
const laneGap: Record<Lane,number> = {spell:.085,material:.085,weapon:.075,voice:.35,hurt:.26,draw:.14,brush:.085,signal:.10};
export function createCueMixer() {
  const lastKind=new Map<string,number>(), lastLane=new Map<Lane,number>();
  return (cues: readonly Cue[], now: number) => {
    const result: Cue[]=[];
    // An oft-repeated attack gets a turn again after less recently heard events.
    const ordered=cues.length<2 ? cues : [...cues].sort((a,b)=>{
      const brush=Number(mix[b.kind][0]==="brush")-Number(mix[a.kind][0]==="brush");
      return brush || (lastKind.get(identity(a)) ?? -Infinity)-(lastKind.get(identity(b)) ?? -Infinity) || 0;
    });
    for (const cue of ordered) {
      const [lane,gap]=mix[cue.kind];
      const key=identity(cue);
      if (now-(lastKind.get(key)??-Infinity)<gap || now-(lastLane.get(lane)??-Infinity)<laneGap[lane]) continue;
      lastKind.set(key,now);lastLane.set(lane,now);result.push(cue);
      if (result.length===4) break;
    }
    return result;
  };
}

export function spellOpening(spell: FieldSpell): Cue {
  const {kind,x,id}=spell;
  const opening=kind==="wormhole" ? "portalOpen" : kind==="meteor" ? "fall" : kind==="gust" || kind==="rain" ? kind : "spellSet";
  return {kind:opening,x,seed:id,spell:opening==="spellSet" ? kind : undefined};
}

// A null attack is voiced by its projectile, windup, beam, or impact below.
const attacks = {
  warrior:"clash", archer:"bow", shieldbearer:"shieldBash", medic:"staff", lancer:"thrust", bomber:"fuse",
  musketeer:"shot", scout:"dart", miner:"pickaxe", clown:"toss", reaper:"scythe", witch:"hex", cyclops:null,
  zombie:"bite", frostqueen:"shard", mouse:"clockBite", workshop:null, engineer:"wrench", post:"bolt", lobber:"sling",
  sunlens:null, belltower:"toll", drone:null, kirin:null, phoenix:"screech", monk:"punch", liondancers:"cymbals",
  rhinorider:"hornJab", trojanhorse:"timberRam", windmill:null, harpoon:"winch", prism:null, snowman:"snow",
  hydra:"hiss", medusa:null, vampire:"flutter", sandworm:null, slime:"squelch", horseman:"pumpkinThrow",
  werewolf:"traveler", cerberus:"bark", kraken:"splash", firedragon:null, irongolem:"anvil", pig:"pigButt",
} satisfies Record<UnitKind,CueKind|null>;
function hurtVoice(u: Unit): CueKind {
  switch (u.kind) {
    case "slime": return "squelch";
    case "snowman": return "snow";
    case "irongolem": case "harpoon": return "metal";
    case "prism": return "reflect";
    case "trojanhorse": return "wood";
    case "hydra": case "rhinorider": case "sandworm": case "kraken": case "cerberus": case "firedragon": return "beastHurt";
    case "horseman": case "vampire": return "whisper";
    case "werewolf": if (u.wolfUntil !== undefined) return "beastHurt"; break;
  }
  if(isBuilding(u.kind)) return u.kind==="sunlens"?"metal":"wood";
  if(u.kind==="drone" || u.kind==="mouse") return "metal";
  if(u.kind==="phoenix") return "birdHurt";
  if(u.kind==="pig") return "squeal";
  if(u.kind==="kirin" || u.kind==="cyclops" || u.kind==="reaper" || u.kind==="zombie")return "beastHurt";
  return "hit";
}

export function battleCues(before: World | undefined, world: World): Cue[] {
  if (!before || world === before || world.tick < before.tick || world.tick-before.tick>12) return [];
  const groups = new Map<string,{cue:Cue;sum:number;count:number}>();
  function add(kind: CueKind,x: number,id: number,tick=world.tick,detail: Pick<Cue,"unit"|"level"|"spell"|"chain"|"beat">={}) {
    const variation=(Math.imul(id,31)+tick*13)>>>0;
    // Each human keeps their voice across hits, with two takes from the same performer.
    const seed=kind==="hit" ? ((variation & ~1) | (id & 1))>>>0 : variation;
    const key=kind+"."+(detail.unit??detail.spell??"");
    const group=groups.get(key);
    if(group){
      group.sum+=x; group.count++;
      if(seed<group.cue.seed)group.cue={kind,x,seed,...detail};
    } else groups.set(key,{cue:{kind,x,seed,...detail},sum:x,count:1});
  }
  const fresh=(tick: number|null|undefined): tick is number => tick!=null && tick>before.tick && tick<=world.tick;
  for (const s of world.spells??[]) {
    const kind=s.kind, pulse=s.startTick+SPELLS[kind].delay;
    if(s.startTick>=before.tick && !before.spells?.some(old=>old.id===s.id)){
      const opening=spellOpening(s);
      add(opening.kind,s.x,s.id,s.startTick,{spell:opening.spell});
    }
    if(fresh(pulse) && kind!=="wormhole" && kind!=="rain" && kind!=="gust")add(kind==="meteor"?"impact":kind,s.x,s.id,pulse);
    if(kind==="fault" && fresh(s.startTick+SPELLS.fault.aftershock))add("fault",s.x,s.id,s.startTick+SPELLS.fault.aftershock);
    if(s.reflection && fresh(s.reflection.tick))add("reflect",s.reflection.x,s.id,s.reflection.tick);
  }
  if (world.units!==before.units) {
    const previous=new Map(before.units.map(u=>[u.id,u]));
    for (const u of world.units) {
      const old=previous.get(u.id);
      if(!old && u.makerId===undefined)add("place",u.x,u.id);
      if(fresh(u.warpedTick))add("wormhole",u.x,u.id,u.warpedTick);
      if(fresh(u.lastBlockTick))add(u.kind==="windmill"?"fan":"block",u.x,u.id,u.lastBlockTick);
      else if(fresh(u.lastHitTick) && (!world.bases || u.hp || u.killedBy!==undefined)){
        const hurt=hurtVoice(u);
        add(hurt,u.x,u.id,u.lastHitTick,hurt==="hit" ? undefined : {unit:u.kind});
      }
      if(fresh(u.lastChargeReadyTick))add(u.kind==="rhinorider"?"snort":"charge",u.x,u.id,u.lastChargeReadyTick);
      if(fresh(u.lastDrawTick))add("bowDraw",u.x,u.id,u.lastDrawTick);
      if(u.windup?.kind==="smash" && fresh(u.windup.since))add("roar",u.x,u.id,u.windup.since);
      if(u.windup?.kind==="breath" && fresh(u.windup.since))add("inhale",u.x,u.id,u.windup.since);
      if(fresh(u.lastSmashTick))add("smash",u.x,u.id,u.lastSmashTick);
      if(fresh(u.lastSqueakTick))add("squeak",u.x,u.id,u.lastSqueakTick);
      if(fresh(u.lastHatchTick))add("rebirth",u.x,u.id,u.lastHatchTick);
      if(u.lastSwallow && fresh(u.lastSwallow.tick))add("gulp",u.x,u.id,u.lastSwallow.tick);
      if(u.kind==="miner" && fresh(u.emergedTick))add("breakSoil",u.x,u.id,u.emergedTick);
      if(u.kind==="sandworm" && u.tunnel && fresh(u.tunnel.start))add("burrow",u.x,u.id,u.tunnel.start);
      if(fresh(u.lastSpawnTick))add(u.kind==="workshop"?"windKey":"raisePost",u.x,u.id,u.lastSpawnTick);
      if((u.kind==="medic" || u.kind==="engineer") && fresh(u.lastHealTick))add(u.kind==="medic"?"bandage":"repair",u.x,u.id,u.lastHealTick);
      if(old && fresh(u.splitTick))add("slimeSplit",u.x,u.id,u.splitTick);
      if(u.kind==="slime" && old?.smallSlime && !u.smallSlime && u.hp>0)add("fuseSlime",u.x,u.id);
      if(u.kind==="hydra" && old && (u.heads??2)>(old.heads??2))add("regrow",u.x,u.id);
      if(u.kind==="irongolem" && fresh(u.lastTreatedTick) && !old?.spareUsed && u.spareUsed)add("rivet",u.x,u.id,u.lastTreatedTick);
      if(u.kind==="snowman" && old && (u.snowStock??3)>(old.snowStock??3))add("packSnow",u.x,u.id);
      if(u.kind==="vampire" && fresh(u.lastHealTick))add("drain",u.x,u.id,u.lastHealTick);
      if(fresh(u.headLandedTick) && u.headSpot)add("pumpkinLand",u.headSpot.x,u.id,u.headLandedTick);
      if(u.burn && fresh(u.burn.applied) && !(old?.burn && old.burn.until>=before.tick))add("kindle",u.x,u.id,u.burn.applied);
      if(u.poison && fresh(u.poison.applied) && !(old?.poison && old.poison.until>=before.tick))add("venom",u.x,u.id,u.poison.applied);
      if(fresh(u.openedTick))add("hatch",u.x,u.id,u.openedTick);
      if(u.kind==="werewolf" && u.wolfUntil!==undefined && u.wolfUntil>world.tick && (old?.wolfUntil??0)<=before.tick)
        add("howl",u.x,u.id);
      if(u.soul && fresh(u.soul.tick))add("soulCatch",u.x,u.id,u.soul.tick);
      if(u.zombified && fresh(u.zombified.tick))add("groan",u.x,u.id,u.zombified.tick);
      if(u.hex && fresh(u.hex.since))add("squeal",u.x,u.id,u.hex.since);
      if(u.kind==="prism" && u.targetId!==null && u.focusSince!==undefined){
        if(fresh(u.focusSince))add("prism",u.x,u.id,u.focusSince);
        else if(old?.focusSince===u.focusSince){
          const level=prismLevel(world.tick-u.focusSince);
          if(level>prismLevel(before.tick-u.focusSince))add("facet",u.x,u.id,world.tick,{level});
        }
      }
      if(u.kind==="windmill" && u.targetId!=null && old?.targetId!==u.targetId)add("sails",u.x,u.id);
      if(u.beam && fresh(u.beam.tick))add("lens",u.x,u.id,u.beam.tick);
      if(u.arc && fresh(u.arc.tick)){
        add("kirinCall",u.x,u.id,u.arc.tick);
        add("thunder",u.x,u.id,u.arc.tick,{chain:u.arc.path.slice(1).map(point=>point.x)});
      }
      // Darts may already have struck by the next room snapshot. The burst clock
      // was advanced by the release itself and still identifies its firing tick.
      if(u.kind==="drone" && u.nextBurstTick!==undefined){
        const release=u.nextBurstTick-UNIT_DEFINITIONS.drone.burstGap;
        if(fresh(release))add("droneBolt",u.x,u.id,release);
      }
      if(!fresh(u.lastAttackTick))continue;
      let sound: CueKind|null=attacks[u.kind];
      if(u.kind==="rhinorider" && u.lastChargeTick===u.lastAttackTick)sound="hornCrash";
      if(u.kind==="werewolf" && (u.wolfUntil??0)>u.lastAttackTick)sound="wolfClaw";
      if(u.kind==="liondancers" && u.lastKickTick===u.lastAttackTick)sound="backKick";
      if(sound==="punch" && u.flurryStartedTick!==undefined){
        const beat=Math.floor((u.lastAttackTick-u.flurryStartedTick)/UNIT_DEFINITIONS.monk.punchGap);
        add(sound,u.x,u.id,u.lastAttackTick,{beat});
      } else if(sound)add(sound,u.x,u.id,u.lastAttackTick);
    }
  }
  for(const b of world.bases??[]){
    if(fresh(b.lastHitTick))add(b.hp===0 && before.bases?.some(old=>old.id===b.id && old.hp>0)?"keepFall":"wood",b.x,b.id,b.lastHitTick);
    if(fresh(b.lastShotTick))add("keepBolt",b.x,b.id,b.lastShotTick);
  }
  for(const e of world.effects??[]) if(fresh(e.tick)) {
    if(e.kind==="glass")add("glass",e.x,Math.round(e.y),e.tick);
    if(e.kind==="stonefall")add("boulderLand",e.x,Math.round(e.y),e.tick);
    if(e.kind==="blast")add("bombBlast",e.x,Math.round(e.y),e.tick);
    if(e.kind==="frost")add("frostLand",e.x,Math.round(e.y),e.tick);
    if(e.kind==="breath")add("fireBreath",e.fromX??e.x,Math.round(e.y),e.tick);
    if(e.kind==="gaze")add("stoneGaze",e.fromX??e.x,Math.round(e.y),e.tick);
    if(e.kind==="harpoon")add("hook",e.x,Math.round(e.y),e.tick);
    if(e.kind==="breach")add("breach",e.x,Math.round(e.y),e.tick);
  }
  return [...groups.values()].sort((a,b)=>priority.get(a.cue.kind)!-priority.get(b.cue.kind)!)
    .map(({cue,sum,count})=>({...cue,x:sum/count}));
}

export function pausedPlacementCues(before: World | undefined, world: World): Cue[] {
  if(!before || before.tick!==world.tick || before===world)return [];
  const cues=battleCues(before,world).filter(cue=>cue.kind==="place");
  for(const s of world.spells??[]) if(s.startTick===world.tick && !before.spells?.some(old=>old.id===s.id))
    cues.push({kind:"spellSet",spell:s.kind,x:s.x,seed:s.id});
  return cues;
}

export function matchCues(before: Snapshot | undefined, after: Snapshot, team: Team | undefined): Cue[] {
  if(!team || !before || before.round!==after.round || after.world.tick-before.world.tick>12)return [];
  let kind: CueKind, level: number|undefined;
  if(after.phase==="finished" && before.phase!=="finished" && after.outcome)
    kind=after.outcome==="draw" ? "stalemate" : after.outcome===team ? "victory" : "defeat";
  else if(before.phase==="countdown" && after.phase==="running")kind="march";
  else if(after.phase==="countdown" && (before.phase!=="countdown" || before.countdown!==after.countdown)){
    kind="count"; level=4-after.countdown;
  } else if(after.phase==="deploy" && !before.seats[team]?.ready && after.seats[team]?.ready)kind="ready";
  else return [];
  return [{kind,level,x:ARENA.width/2,seed:after.round}];
}
