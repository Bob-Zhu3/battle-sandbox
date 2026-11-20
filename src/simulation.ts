import { firstArrowImpact, type Arrow } from "./arrows.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

export const TICKS_PER_SECOND = 60;
export const ARENA = { width: 960, height: 360 } as const;
export const WARRIOR = UNIT_DEFINITIONS.warrior;

export type Team = "red" | "blue";
export type Outcome = Team | "draw";

export interface Placement {
  id: number;
  team: Team;
  kind?: UnitKind;
  x: number;
  y: number;
}

export interface Unit extends Placement {
  kind: UnitKind;
  hp: number;
  nextAttackTick: number;
  lastHitTick: number | null;
}

export type Warrior = Unit & { kind: "warrior" };

export class Battle {
  tick: number;
  units: Unit[];
  arrows: Arrow[];

  constructor(tick: number, units: Unit[], arrows: Arrow[]) {
    this.tick = tick;
    this.units = units;
    this.arrows = arrows;
  }

  // Preserve the Warrior-only view used by the original Node callers.
  get warriors(): Warrior[] {
    return this.units.filter((unit): unit is Warrior => unit.kind === "warrior");
  }
}

export function boundCenter(value: number, extent: number, radius: number = WARRIOR.radius): number {
  return Math.max(radius, Math.min(extent - radius, value));
}

export function createBattle(placements: readonly Placement[]): Battle {
  const ids = new Set(placements.map((unit) => unit.id));
  if (ids.size !== placements.length) {
    throw new Error("Each unit needs a unique ID.");
  }

  const units = placements.map((placement) => {
    const kind = placement.kind ?? "warrior";
    const { radius, maxHp } = UNIT_DEFINITIONS[kind];
    return {
      ...placement, kind, x: boundCenter(placement.x, ARENA.width, radius), y: boundCenter(placement.y, ARENA.height, radius),
      hp: maxHp, nextAttackTick: 1, lastHitTick: null,
    };
  });
  return new Battle(0, units, []);
}

export function createDuel(): Battle {
  return createBattle([
    { id: 1, team: "red", x: 210, y: ARENA.height / 2 },
    { id: 2, team: "blue", x: ARENA.width - 210, y: ARENA.height / 2 },
  ]);
}

function nearestEnemy(seeker: Unit, units: readonly Unit[]): Unit | undefined {
  let closest: Unit | undefined;
  let closestDistance = Infinity;
  for (const unit of units) {
    if (unit.team === seeker.team || unit.hp <= 0) continue;
    const distance = (unit.x - seeker.x) ** 2 + (unit.y - seeker.y) ** 2;
    if (!closest || distance < closestDistance || (distance === closestDistance && unit.id < closest.id)) {
      closest = unit;
      closestDistance = distance;
    }
  }
  return closest;
}

function separateFootprints(previous: readonly Unit[], next: Unit[], solid: readonly boolean[]) {
  const push = next.map(() => ({ x: 0, y: 0 }));
  let overlapping = false;
  for (let i = 0; i < next.length; i++) {
    const a = next[i];
    if (!solid[i]) continue;
    for (let j = i + 1; j < next.length; j++) {
      const b = next[j];
      if (!solid[j]) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const squared = dx * dx + dy * dy;
      const touching = UNIT_DEFINITIONS[a.kind].radius + UNIT_DEFINITIONS[b.kind].radius;
      if (squared >= touching * touching) continue;
      overlapping = true;
      const distance = Math.sqrt(squared);
      let nx, ny;
      if (distance > 0) {
        nx = dx / distance;
        ny = dy / distance;
      } else {
        // Coincident centers have no normal. Give each pair a repeatable bearing.
        const pair = 31 * Math.min(a.id, b.id) + Math.max(a.id, b.id);
        const angle = pair * Math.PI * (3 - Math.sqrt(5));
        const sign = a.id < b.id ? 1 : -1;
        nx = sign * Math.cos(angle);
        ny = sign * Math.sin(angle);
      }
      const halfOverlap = (touching - distance) / 2;
      push[i].x -= nx * halfOverlap;
      push[i].y -= ny * halfOverlap;
      push[j].x += nx * halfOverlap;
      push[j].y += ny * halfOverlap;
    }
  }

  // Apply all pair corrections together. Each unit still moves at its own walking speed.
  for (const [i, unit] of next.entries()) {
    if (!solid[i]) continue;
    const from = previous[i];
    const dx = unit.x - from.x + push[i].x;
    const dy = unit.y - from.y + push[i].y;
    const distance = Math.hypot(dx, dy);
    const { speed, radius } = UNIT_DEFINITIONS[unit.kind];
    const walkStep = speed / TICKS_PER_SECOND;
    const fraction = distance > walkStep ? walkStep / distance : 1;
    unit.x = boundCenter(from.x + dx * fraction, ARENA.width, radius);
    unit.y = boundCenter(from.y + dy * fraction, ARENA.height, radius);
  }
  return overlapping;
}

export function stepBattle(battle: Battle): Battle {
  const tick = battle.tick + 1;
  const damage = new Map<number, number>();
  const arrows: Arrow[] = [];

  // Movement, targeting and releases all start from the same snapshot.
  const units = battle.units.map((unit) => {
    const next = { ...unit };
    if (unit.hp <= 0) return next;
    const target = nearestEnemy(unit, battle.units);
    if (!target) return next;

    const definition = UNIT_DEFINITIONS[unit.kind];
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const distance = Math.hypot(dx, dy);
    const stopAt = definition.attack === "arrow" ? definition.reach : definition.radius + UNIT_DEFINITIONS[target.kind].radius;
    if (distance > stopAt) {
      const travel = Math.min(definition.speed / TICKS_PER_SECOND, distance - stopAt);
      next.x += (dx / distance) * travel;
      next.y += (dy / distance) * travel;
    }
    if (distance <= definition.reach && tick >= unit.nextAttackTick) {
      next.nextAttackTick = tick + definition.cooldownTicks;
      if (definition.attack === "melee") {
        damage.set(target.id, (damage.get(target.id) ?? 0) + definition.damage);
      } else {
        const step = definition.arrowSpeed / TICKS_PER_SECOND;
        const facing = unit.team === "red" ? 1 : -1;
        arrows.push({
          x: unit.x, y: unit.y, team: unit.team, releasedTick: tick, damage: definition.damage,
          vx: step * (distance > 0 ? dx / distance : facing), vy: step * (distance > 0 ? dy / distance : 0),
        });
      }
    }
    return next;
  });

  // A lethal melee hit frees the footprint immediately, as in the original duel.
  // Arrows below use the resulting movement paths and the starting list of living enemies.
  const solid = units.map(unit => unit.hp > (damage.get(unit.id) ?? 0));
  for (let pass = 0; pass < 4; pass++) {
    if (!separateFootprints(battle.units, units, solid)) break;
  }
  // Only previously released arrows fly this tick. Each one is consumed by its first hit.
  for (const arrow of battle.arrows) {
    const hit = firstArrowImpact(arrow, battle.units, units);
    if (hit) {
      damage.set(hit.id, (damage.get(hit.id) ?? 0) + arrow.damage);
      continue;
    }
    const x = arrow.x + arrow.vx, y = arrow.y + arrow.vy;
    if (x >= 0 && x <= ARENA.width && y >= 0 && y <= ARENA.height) arrows.push({ ...arrow, x, y });
  }
  for (const unit of units) {
    const amount = damage.get(unit.id);
    if (amount === undefined) continue;
    unit.hp = Math.max(0, unit.hp - amount);
    unit.lastHitTick = tick;
  }
  return new Battle(tick, units, arrows);
}

export function battleOutcome(battle: Battle): Outcome | null {
  const redAlive = battle.units.some((unit) => unit.team === "red" && unit.hp > 0);
  const blueAlive = battle.units.some((unit) => unit.team === "blue" && unit.hp > 0);
  if (redAlive && blueAlive) return null;
  if (redAlive) return battle.arrows.some(arrow => arrow.team === "blue") ? null : "red";
  if (blueAlive) return battle.arrows.some(arrow => arrow.team === "red") ? null : "blue";
  return "draw";
}
