import { circleEntry } from "./arrows.ts";
import { ARENA } from "./battlefield.ts";
import { interrupt } from "./conditions.ts";
import type { Unit } from "./simulation.ts";
import { SPELLS, type FieldSpell } from "./spells.ts";
import { footprint } from "./units.ts";

// Projectiles and normal movement have already resolved. Only the real step into
// the entrance is swept; the jump between the two mouths is instantaneous.
export function transportEnemies(spells: readonly FieldSpell[], before: readonly Unit[], units: readonly Unit[], tick: number) {
  const gates = spells.flatMap(spell => spell.entrance && spell.startTick < tick
    ? [{spell, entrance: spell.entrance, held: new Set(spell.arrivalIds), arrivals: [] as number[]}] : []);
  for (const [i, unit] of units.entries()) {
    if (unit.hp <= 0 || unit.tunnel) continue;
    const old = before[i];
    const from = old && !old.tunnel && old.team === unit.team ? old : unit;
    const radius = footprint(unit);
    const touch = SPELLS.wormhole.radius + radius;
    let first: FieldSpell | undefined, soonest = Infinity;
    for (const {spell, entrance, held} of gates) {
      if (spell.team === unit.team || held.has(unit.id)) continue;
      const entry = circleEntry(from.x - entrance.x, from.y - entrance.y, unit.x - from.x, unit.y - from.y, touch);
      if (entry === undefined || tick - 1 + entry >= spell.startTick + SPELLS.wormhole.duration) continue;
      if (!first || entry < soonest || (entry === soonest && spell.id < first.id)) {
        first = spell; soonest = entry;
      }
    }
    if (first) {
      unit.x = Math.max(radius, Math.min(ARENA.width - radius, first.x));
      unit.y = Math.max(radius, Math.min(ARENA.height - radius, first.y));
      unit.warpedTick = tick; unit.targetId = null; unit.pace = 0;
      interrupt(unit);
      delete unit.knockback; delete unit.trail;
      first.lastPassageTick = tick;
    }
    // Landing on another entrance (or on this one) is not a second crossing.
    for (const {spell, entrance, held, arrivals} of gates) {
      if (spell.team === unit.team || (!first && !held.has(unit.id))) continue;
      if ((unit.x - entrance.x) ** 2 + (unit.y - entrance.y) ** 2 <= touch * touch) arrivals.push(unit.id);
    }
  }
  for (const {spell, arrivals} of gates) {
    if (arrivals.length) spell.arrivalIds = arrivals;
    else delete spell.arrivalIds;
  }
}
