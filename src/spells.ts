import { ARENA, BASE_RADIUS, type Team } from "./battlefield.ts";
import type { Arrow } from "./arrows.ts";
import type { Target, Unit } from "./simulation.ts";
import { isBuilding, isMachine, UNIT_DEFINITIONS } from "./units.ts";

export const SPELLS = {
  gust: { name: "Gust", command: "cast-gust", cost: 10, radius: 70, delay: 8, duration: 32,
    description: "Pushes enemies outward, scatters incoming arrows and fans friendly Phoenix embers." },
  meteor: { name: "Meteor", command: "cast-meteor", cost: 20, radius: 58, delay: 48, duration: 69,
    description: "Marks the ground, then strikes enemies inside the ring. Troops can escape the shadow." },
  rain: { name: "Healing Rain", command: "cast-rain", cost: 15, radius: 65, delay: 12, duration: 100,
    description: "Three showers heal allies and put out burning feathers or clothing. Rain puts out enemy Phoenix eggs." },
} as const;
export type SpellKind = keyof typeof SPELLS;
export type SpellType = (typeof SPELLS)[SpellKind]["command"];
export const SPELL_KINDS = Object.keys(SPELLS) as SpellKind[];
export function spellKind(type: unknown) { return SPELL_KINDS.find(kind => SPELLS[kind].command === type); }
export interface FieldSpell { id: number; team: Team; kind: SpellKind; x: number; y: number; startTick: number }

export function pulses(spell: FieldSpell, tick: number) {
  const age = tick - spell.startTick;
  return age === SPELLS[spell.kind].delay || (spell.kind === "rain" && (age === 48 || age === 84));
}
export function insideSpell(spell: FieldSpell, point: {x: number; y: number}, extra = 0) {
  return Math.hypot(spell.x - point.x, spell.y - point.y) <= SPELLS[spell.kind].radius + extra;
}
export function blownAway(shot: Arrow, winds: readonly FieldSpell[]) {
  return shot.kind !== "bomb" && shot.kind !== "bullet" && winds.some(wind => wind.team !== shot.team && insideSpell(wind, shot));
}

export function applyMagic(active: readonly FieldSpell[], units: Unit[], targets: readonly Target[], tick: number,
  hit: (target: Target, amount: number, team: Team) => void, heals: Map<number, number>) {
  for (const spell of active) {
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
