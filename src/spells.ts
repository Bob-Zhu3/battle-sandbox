import { ARENA, BASE_RADIUS, type Team } from "./battlefield.ts";
import type { Arrow } from "./arrows.ts";
import type { Target, Unit } from "./simulation.ts";
import type { ArenaPoint } from "./deployment.ts";
import { airborne, canCharge, footprint, isBuilding, isMachine, UNIT_DEFINITIONS } from "./units.ts";

export const SPELLS = {
  gust: { name: "Gust", command: "cast-gust", cost: 10, radius: 70, delay: 8, duration: 32,
    description: "Pushes enemies outward, scatters incoming arrows and fans friendly Phoenix embers." },
  meteor: { name: "Meteor", command: "cast-meteor", cost: 20, radius: 58, delay: 48, duration: 69,
    description: "Falls from the top of the field onto the marked ground. Troops can escape its shadow." },
  rain: { name: "Healing Rain", command: "cast-rain", cost: 15, radius: 65, delay: 12, duration: 100,
    description: "Three showers heal allies, put out fires and enemy Phoenix eggs, and fog enemy Sun Lenses." },
  fault: { name: "Fault Line", command: "cast-fault-line", cost: 18, radius: 60, delay: 16, aftershock: 44, duration: 66,
    structureDamage: 12, troopDamage: 3, baseDamage: 3,
    description: "Two tremors crack enemy buildings. A tremor under a tunneling Miner or Sandworm forces it to surface on the spot." },
  briar: { name: "Vines", command: "cast-briar-snare", cost: 13, radius: 57, delay: 14, duration: 42, holdTicks: 78,
    description: "Climbing vines wrap around enemy feet. Rooted troops can still attack. Fire burns the vines away." },
  mirror: { name: "Mirror Ward", command: "cast-mirror-ward", cost: 14, radius: 46, delay: 6, duration: 180, panes: 3,
    description: "Three panes turn incoming enemy arrows and bolts back toward their source. Bullets, boulders and magic pass through." },
  freeze: { name: "Freeze", command: "cast-freeze", cost: 18, radius: 62, delay: 12, duration: 39, hold: 66, baseHold: 33,
    description: "Encases enemies in ice and cuts a charge short. Bases thaw sooner. A Phoenix strike melts the ice." },
  lightning: { name: "Lightning", command: "cast-lightning", cost: 24, radius: 83, delay: 18, duration: 44, targets: 3, damage: 18, baseDamage: 6, stunTicks: 15,
    description: "Calls down a bolt on each of the three healthiest enemies in the circle. Each strike deals damage and stuns." },
  rage: { name: "Rage", command: "cast-rage", cost: 14, radius: 66, delay: 8, duration: 152, speedFactor: 1.4,
    description: "Allied troops inside the ring move 40% faster and recover attacks 50% faster. Late arrivals join the rush." },
  wormhole: { name: "Wormhole", command: "cast-wormhole", cost: 19, radius: 48, delay: 0, duration: 300,
    description: "Place an entrance, then an exit. For five seconds, enemy troops touching the entrance travel to the exit. Works under enemy towers too." },
} as const;
export type SpellKind = keyof typeof SPELLS;
export function castHint(kind: SpellKind, hasEntrance = false) {
  if (kind==="wormhole") return hasEntrance ? "Tap the exit to open both portals for 5 seconds." : "Tap the entrance to catch enemy troops and towers.";
  return "Tap anywhere to cast "+SPELLS[kind].name+".";
}
export type SpellType = (typeof SPELLS)[SpellKind]["command"];
export const SPELL_KINDS = Object.keys(SPELLS) as SpellKind[];
export function spellKind(type: unknown) { return SPELL_KINDS.find(kind => SPELLS[kind].command === type); }
export interface FieldSpell {
  id: number; team: Team; kind: SpellKind; x: number; y: number; startTick: number;
  reflection?: {count: number; tick: number; x: number; y: number};
  strikes?: {id: number; x: number; y: number}[];
  entrance?: ArenaPoint;
  lastPassageTick?: number;
  arrivalIds?: number[]; // Units deposited inside this mouth must leave before entering it again.
}

// These records describe the floor after a cast. Only active spells participate in combat.
export const MARK_TICKS = { meteor: 360, fault: 270, lightning: 225 } satisfies Partial<Record<SpellKind, number>>;
type MarkKind = keyof typeof MARK_TICKS;
export type SpellMark = Pick<FieldSpell, "id" | "team" | "x" | "y" | "startTick" | "strikes"> & { kind: MarkKind };
export function leavesGroundMark(kind: SpellKind): kind is MarkKind {
  return Object.hasOwn(MARK_TICKS,kind);
}
export const MAX_SPELL_MARKS = 64;
export function floorAfterCast(old: SpellMark[] | undefined, spells: FieldSpell[] | undefined, tick: number) {
  const visible=(m: SpellMark)=>leavesGroundMark(m.kind) && tick<m.startTick+SPELLS[m.kind].duration+MARK_TICKS[m.kind];
  if (!spells?.length && (!old || old.every(visible))) return old;
  const marks = old?.filter(visible) ?? [];
  for (const s of spells ?? []) {
    if (!leavesGroundMark(s.kind) || tick !== s.startTick + SPELLS[s.kind].duration) continue;
    const mark: SpellMark = { id:s.id, kind:s.kind, team:s.team, x:s.x, y:s.y, startTick:s.startTick };
    if (s.strikes) mark.strikes = s.strikes;
    marks.push(mark);
  }
  return marks.length ? marks.slice(-MAX_SPELL_MARKS) : undefined;
}

export function makeFieldSpell(id: number, kind: SpellKind, team: Team, x: number, y: number, startTick: number, entrance?: ArenaPoint): FieldSpell {
  const spell: FieldSpell = {id,kind,team,x,y,startTick};
  if (kind==="wormhole") {
    if (!entrance) throw new Error("Choose both a Wormhole entrance and an exit.");
    spell.entrance = {x:entrance.x, y:entrance.y};
  }
  return spell;
}

export function pulses(spell: FieldSpell, tick: number) {
  const age = tick - spell.startTick;
  return age === SPELLS[spell.kind].delay || (spell.kind === "rain" && (age === 48 || age === 84)) ||
    (spell.kind === "fault" && age === SPELLS.fault.aftershock);
}
export function insideSpell(spell: FieldSpell, point: {x: number; y: number}, extra = 0) {
  return Math.hypot(spell.x - point.x, spell.y - point.y) <= SPELLS[spell.kind].radius + extra;
}
export function blownAway(shot: Arrow, winds: readonly FieldSpell[]) {
  return shot.kind !== "head" && shot.kind !== "stone" && shot.kind !== "bomb" && shot.kind !== "bullet" && winds.some(wind => wind.team !== shot.team && insideSpell(wind, shot));
}

// Resolve these on a copy of the opening position, before troops choose targets or spend a charge.
export function prepareFieldMagic(unit: Unit, pulses: readonly FieldSpell[], tick: number) {
  const affected = (kind: SpellKind) => pulses.some(s => s.kind === kind && s.team !== unit.team && insideSpell(s,unit));
  if (unit.tunnel && affected("fault")) {
    delete unit.tunnel; unit.emergedTick = tick;
    const recovery=unit.kind==="sandworm" ? UNIT_DEFINITIONS.sandworm.cooldownTicks : UNIT_DEFINITIONS.miner.emergeTicks;
    unit.nextAttackTick = Math.max(unit.nextAttackTick,tick+recovery);
  }
  if (!unit.tunnel && !airborne(unit) && !isBuilding(unit.kind) && unit.emberUntil === undefined && !unit.burn && affected("briar")) {
    unit.rootedUntil = Math.max(unit.rootedUntil ?? 0,tick+SPELLS.briar.holdTicks);
    if (canCharge(unit.kind)) unit.runUp = 0;
  }
  if (unit.kind === "sunlens" && affected("rain")) {
    delete unit.focusSince; unit.targetId = null; unit.fogUntil = tick+UNIT_DEFINITIONS.sunlens.fogTicks;
  }
}

export function applyMagic(active: readonly FieldSpell[], units: Unit[], targets: readonly Target[], tick: number,
  hit: (target: Target, amount: number, team: Team) => void, heals: Map<number, number>) {
  for (const spell of active) {
    if (spell.kind === "fault") {
      for (const target of targets) {
        if (target.team === spell.team || target.hp <= 0 || airborne(target) || !insideSpell(spell,target,target.kind === "base" ? BASE_RADIUS : 0)) continue;
        const rule = SPELLS.fault;
        hit(target,target.kind === "base" ? rule.baseDamage : isBuilding(target.kind) ? rule.structureDamage : rule.troopDamage,spell.team);
      }
      continue;
    }
    if (spell.kind === "meteor") {
      for (const target of targets) {
        if (target.team !== spell.team && target.hp > 0 && (target.kind === "base" || !target.tunnel) && insideSpell(spell, target, target.kind === "base" ? BASE_RADIUS : 0))
          hit(target, target.kind === "base" ? 6 : 17, spell.team);
      }
      continue;
    }
    if (spell.kind !== "rain" && spell.kind !== "gust") continue;
    for (const unit of units) {
      if (unit.hp <= 0 || unit.tunnel) continue;
      const friendly = unit.team === spell.team;
      if (!friendly && spell.kind === "gust" && unit.kind === "horseman" && unit.headLandedTick !== undefined && unit.headSpot && insideSpell(spell,unit.headSpot)) {
        const dx=unit.headSpot.x-spell.x,dy=unit.headSpot.y-spell.y,d=Math.hypot(dx,dy);
        unit.headSpot={x:Math.max(4,Math.min(ARENA.width-4,unit.headSpot.x+(d?dx/d:1)*42)),y:Math.max(4,Math.min(ARENA.height-4,unit.headSpot.y+(d?dy/d:0)*42))};
      }
      if (!insideSpell(spell,unit)) continue;
      if (friendly && spell.kind === "gust" && unit.kind === "windmill") unit.millFastUntil=tick+UNIT_DEFINITIONS.windmill.spinTicks;
      if (spell.kind === "rain") {
        if (friendly) delete unit.burn;
        if (!friendly && unit.emberUntil !== undefined) hit(unit, 1, spell.team);
        if (friendly && !isMachine(unit.kind) && unit.emberUntil === undefined) heals.set(unit.id, (heals.get(unit.id) ?? 0) + 5);
      } else if (friendly && unit.emberUntil !== undefined) {
        delete unit.emberUntil;
        unit.hp = Math.ceil(UNIT_DEFINITIONS.phoenix.maxHp / 2);
        unit.lastHatchTick = tick;
      } else if (!friendly && !isBuilding(unit.kind) && unit.emberUntil === undefined) {
        const dx = unit.x - spell.x, dy = unit.y - spell.y;
        const d = Math.hypot(dx, dy);
        const dirX = d ? dx / d : Math.cos(unit.id * 2.4), dirY = d ? dy / d : Math.sin(unit.id * 2.4);
        const move = (24 + 16 * (1 - d / SPELLS.gust.radius))*(unit.kind==="irongolem" ? .22 : 1);
        const r = footprint(unit);
        unit.x = Math.max(r, Math.min(ARENA.width - r, unit.x + dirX * move));
        unit.y = Math.max(r, Math.min(ARENA.height - r, unit.y + dirY * move));
      }
    }
  }
}
