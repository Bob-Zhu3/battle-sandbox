import type { World } from "./room-protocol.ts";
import { SPELLS } from "./spells.ts";

// Order also gives landmark sounds first claim on the mix during a large fight.
export const soundGaps = { impact: .21, fall: .19, thunder: .19, smash: .16, shot: .12, bow: .095,
  block: .12, hit: .10, rain: .21, gust: .21, place: .068 } as const;
export type CueKind = keyof typeof soundGaps;
export interface Cue { kind: CueKind; x: number; seed: number }

export function battleCues(before: World | undefined, world: World): Cue[] {
  if (!before || world === before || world.tick < before.tick || world.tick - before.tick > 12) return [];
  const groups = new Map<CueKind, {sum: number; count: number; seed: number}>();
  function add(kind: CueKind, x: number, seed: number) {
    const group = groups.get(kind);
    if (group) { group.sum += x; group.count++; }
    else groups.set(kind,{sum:x, count:1, seed:seed + world.tick*13});
  }
  const since = before.tick;
  const fresh = (tick: number | null | undefined) => tick != null && tick > since && tick <= world.tick;

  for (const spell of world.spells ?? []) {
    if (spell.startTick >= since && !before.spells?.some(old => old.id === spell.id)) {
      add(spell.kind === "meteor" ? "fall" : spell.kind,spell.x,spell.id);
    }
    if (spell.kind === "meteor" && fresh(spell.startTick+SPELLS.meteor.delay)) add("impact",spell.x,spell.id);
  }
  if (world.units !== before.units) {
    // Placements append to the world. IDs also distinguish an undo followed by another purchase.
    const previousIds = new Set(before.units.map(u => u.id));
    for (const unit of world.units) {
      if (!previousIds.has(unit.id)) add("place",unit.x,unit.id);
      if (fresh(unit.lastBlockTick)) add("block",unit.x,unit.id);
      else if (fresh(unit.lastHitTick)) add("hit",unit.x,unit.id);
      if (fresh(unit.lastSmashTick)) add("smash",unit.x,unit.id);
      if (fresh(unit.arc?.tick)) add("thunder",unit.x,unit.id);
    }
  }
  for (const base of world.bases ?? []) if (fresh(base.lastHitTick)) add("hit",base.x,base.id);
  // Releases come from real projectiles. Hits come from the target's later damage tick.
  for (const arrow of world.arrows) {
    if (fresh(arrow.releasedTick)) add(arrow.kind === "bullet" ? "shot" : "bow",arrow.x,arrow.casterId ?? arrow.releasedTick);
  }
  return (Object.keys(soundGaps) as CueKind[]).flatMap(kind => {
    const g = groups.get(kind);
    return g ? [{kind, x:g.sum/g.count, seed:g.seed}] : [];
  });
}
