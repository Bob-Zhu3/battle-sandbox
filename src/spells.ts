import { ARENA, BASE_RADIUS, type Team } from "./battlefield.ts";
import type { Arrow } from "./arrows.ts";
import type { Target, Unit } from "./simulation.ts";
import { airborne, isBuilding, isMachine, UNIT_DEFINITIONS } from "./units.ts";

export const SPELLS = {
  gust: { name: "Gust", command: "cast-gust", cost: 10, radius: 70, delay: 8, duration: 32,
    description: "Pushes enemies outward, scatters incoming arrows and fans friendly Phoenix embers." },
  meteor: { name: "Meteor", command: "cast-meteor", cost: 20, radius: 58, delay: 48, duration: 69,
    description: "Falls from the top of the field onto the marked ground. Troops can escape its shadow." },
  rain: { name: "Healing Rain", command: "cast-rain", cost: 15, radius: 65, delay: 12, duration: 100,
    description: "Three showers heal allies, put out fires and enemy Phoenix eggs, and fog enemy Sun Lenses." },
  fault: { name: "Fault Line", command: "cast-fault-line", cost: 18, radius: 60, delay: 16, aftershock: 44, duration: 66,
    structureDamage: 12, troopDamage: 3, baseDamage: 3,
    description: "Two tremors crack enemy buildings. A tremor crossing a Miner's dirt trail forces it to surface where it is." },
  briar: { name: "Briar Snare", command: "cast-briar-snare", cost: 13, radius: 57, delay: 14, duration: 42, holdTicks: 78,
    description: "Roots catch enemy feet as the thorns rise. Rooted troops can still attack. Fire burns the vines away." },
  mirror: { name: "Mirror Ward", command: "cast-mirror-ward", cost: 14, radius: 46, delay: 6, duration: 180, panes: 3,
    description: "Three panes turn incoming enemy arrows and bolts back toward their source. Bullets, boulders and magic pass through." },
} as const;
export type SpellKind = keyof typeof SPELLS;
export type SpellType = (typeof SPELLS)[SpellKind]["command"];
export const SPELL_KINDS = Object.keys(SPELLS) as SpellKind[];
export function spellKind(type: unknown) { return SPELL_KINDS.find(kind => SPELLS[kind].command === type); }
export interface FieldSpell {
  id: number; team: Team; kind: SpellKind; x: number; y: number; startTick: number;
  reflection?: {count: number; tick: number; x: number; y: number};
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
  return shot.kind !== "stone" && shot.kind !== "bomb" && shot.kind !== "bullet" && winds.some(wind => wind.team !== shot.team && insideSpell(wind, shot));
}

// Resolve these on a copy of the opening position, before troops choose targets or spend a charge.
export function prepareFieldMagic(unit: Unit, pulses: readonly FieldSpell[], tick: number) {
  const affected = (kind: SpellKind) => pulses.some(s => s.kind === kind && s.team !== unit.team && insideSpell(s,unit));
  if (unit.tunnel && affected("fault")) {
    delete unit.tunnel; unit.emergedTick = tick;
    unit.nextAttackTick = Math.max(unit.nextAttackTick,tick+UNIT_DEFINITIONS.miner.emergeTicks);
  }
  if (!unit.tunnel && !airborne(unit) && !isBuilding(unit.kind) && unit.emberUntil === undefined && !unit.burn && affected("briar")) {
    unit.rootedUntil = Math.max(unit.rootedUntil ?? 0,tick+SPELLS.briar.holdTicks);
    if (unit.kind === "lancer") unit.runUp = 0;
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
    if (spell.kind === "mirror" || spell.kind === "briar") continue;
    if (spell.kind === "meteor") {
      for (const target of targets) {
        if (target.team !== spell.team && target.hp > 0 && (target.kind === "base" || !target.tunnel) && insideSpell(spell, target, target.kind === "base" ? BASE_RADIUS : 0))
          hit(target, target.kind === "base" ? 6 : 17, spell.team);
      }
      continue;
    }
    for (const unit of units) {
      if (unit.hp <= 0 || unit.tunnel || !insideSpell(spell, unit)) continue;
      const friendly = unit.team === spell.team;
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
        const move = 24 + 16 * (1 - d / SPELLS.gust.radius);
        const r = UNIT_DEFINITIONS[unit.kind].radius;
        unit.x = Math.max(r, Math.min(ARENA.width - r, unit.x + dirX * move));
        unit.y = Math.max(r, Math.min(ARENA.height - r, unit.y + dirY * move));
      }
    }
  }
}
