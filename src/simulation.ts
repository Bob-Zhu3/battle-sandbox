import { firstArrowImpact, type Arrow } from "./arrows.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";
import { ARENA, ARMIES, BASE_RADIUS, TEAMS, type Base, type Team } from "./battlefield.ts";
export { ARENA, type Team } from "./battlefield.ts";

export const TICKS_PER_SECOND = 60;
export const WARRIOR = UNIT_DEFINITIONS.warrior;

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
  targetId: number | null;
  aimX: number;
  aimY: number;
  walkDistance: number;
  pace: number;
  lastAttackTick: number | null;
  attackDirection: { x: number; y: number } | null;
  // Archer peeking past cover, or Warrior hearing a friendly shaft pass behind.
  lastAttentionTick: number | null;
  killedBy?: Team;
}

export type Warrior = Unit & { kind: "warrior" };

export class Battle {
  tick: number;
  units: Unit[];
  arrows: Arrow[];
  bases?: Base[];

  constructor(tick: number, units: Unit[], arrows: Arrow[], bases?: Base[]) {
    this.tick = tick;
    this.units = units;
    this.arrows = arrows;
    this.bases = bases;
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
      targetId: null, aimX: ARMIES[placement.team].facing, aimY: 0,
      walkDistance: 0, pace: 0, lastAttackTick: null, attackDirection: null, lastAttentionTick: null,
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

export type Target = Unit | Base;
function nearestEnemy(seeker: Unit, units: readonly Target[]): Target | undefined {
  let closest: Target | undefined;
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

function shootingPastCover(archer: Unit, units: readonly Unit[], range: number) {
  return units.some(ally => {
    if (ally.kind !== "warrior" || ally.team !== archer.team || ally.hp <= 0) return false;
    const dx = ally.x - archer.x, dy = ally.y - archer.y;
    const ahead = dx * archer.aimX + dy * archer.aimY;
    const across = dx * archer.aimY - dy * archer.aimX;
    return ahead > 0 && ahead < range && Math.abs(across) < WARRIOR.radius + 5;
  });
}

// A Warrior can hear an arrow just before it passes its shoulder. This stamps a
// pose only. Allies still let the same projectile through along its original path.
function noticeFriendlyArrow(arrow: Arrow, units: Unit[], tick: number) {
  const speed = Math.hypot(arrow.vx, arrow.vy);
  if (!speed) return;
  const ax = arrow.vx / speed, ay = arrow.vy / speed;
  for (const unit of units) {
    if (unit.team !== arrow.team || unit.kind !== "warrior" || unit.hp <= 0) continue;
    if (unit.lastAttentionTick !== null && tick - unit.lastAttentionTick < 24) continue;
    if (ax * unit.aimX + ay * unit.aimY < .5) continue;
    const dx = unit.x - arrow.x, dy = unit.y - arrow.y;
    const ahead = dx * ax + dy * ay;
    if (ahead >= 0 && ahead <= 26 && Math.abs(dx * ay - dy * ax) <= WARRIOR.radius + 2) {
      unit.lastAttentionTick = tick;
    }
  }
}

export function stepBattle(battle: Battle): Battle {
  const tick = battle.tick + 1;
  const damage = new Map<number, number>();
  const sources = new Map<number, Map<Team, number>>();
  const arrows: Arrow[] = [];
  const targets: readonly Target[] = battle.bases ? [...battle.units, ...battle.bases] : battle.units;
  function hit(target: Target, amount: number, team: Team) {
    damage.set(target.id, (damage.get(target.id) ?? 0) + amount);
    if (!battle.bases || target.kind === "base") return;
    const contributors = sources.get(target.id) ?? new Map<Team, number>();
    contributors.set(team, (contributors.get(team) ?? 0) + amount);
    sources.set(target.id, contributors);
  }

  // Movement, targeting and releases all start from the same snapshot.
  const units = battle.units.map((unit) => {
    const next = { ...unit };
    if (unit.hp <= 0) return next;
    const target = nearestEnemy(unit, targets);
    next.targetId = target?.id ?? null;
    if (!target) return next;

    const definition = UNIT_DEFINITIONS[unit.kind];
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) {
      next.aimX = dx / distance;
      next.aimY = dy / distance;
    } else {
      next.aimX = ARMIES[unit.team].facing;
      next.aimY = 0;
    }
    const reach = definition.reach + (target.kind === "base" ? BASE_RADIUS : 0);
    const targetRadius = target.kind === "base" ? BASE_RADIUS : UNIT_DEFINITIONS[target.kind].radius;
    const stopAt = definition.attack === "arrow" ? reach : definition.radius + targetRadius;
    if (distance > stopAt) {
      const travel = Math.min(definition.speed / TICKS_PER_SECOND, distance - stopAt);
      next.x += (dx / distance) * travel;
      next.y += (dy / distance) * travel;
    }
    if (distance <= reach && tick >= unit.nextAttackTick) {
      next.nextAttackTick = tick + definition.cooldownTicks;
      next.lastAttackTick = tick;
      next.attackDirection = { x: next.aimX, y: next.aimY };
      if (definition.attack === "melee") {
        hit(target, definition.damage, unit.team);
      } else {
        if (shootingPastCover(next, battle.units, distance)) next.lastAttentionTick = tick;
        const step = definition.arrowSpeed / TICKS_PER_SECOND;
        arrows.push({
          x: unit.x, y: unit.y, team: unit.team, releasedTick: tick, damage: definition.damage,
          vx: step * next.aimX, vy: step * next.aimY,
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
  const movedTargets = battle.bases ? [...units, ...battle.bases] : units;
  for (const arrow of battle.arrows) {
    noticeFriendlyArrow(arrow, units, tick);
    const impact = firstArrowImpact(arrow, targets, movedTargets);
    if (impact) {
      hit(impact, arrow.damage, arrow.team);
      continue;
    }
    const x = arrow.x + arrow.vx, y = arrow.y + arrow.vy;
    if (x >= 0 && x <= ARENA.width && y >= 0 && y <= ARENA.height) arrows.push({ ...arrow, x, y });
  }
  for (const [index, unit] of units.entries()) {
    const from = battle.units[index];
    const distance = Math.hypot(unit.x - from.x, unit.y - from.y);
    unit.walkDistance += distance;
    const speed = UNIT_DEFINITIONS[unit.kind].speed / TICKS_PER_SECOND;
    unit.pace += (distance / speed - unit.pace) * .3;
    const amount = damage.get(unit.id);
    if (amount === undefined) continue;
    unit.hp = Math.max(0, unit.hp - amount);
    unit.lastHitTick = tick;
    const contributors = sources.get(unit.id);
    if (!unit.hp && contributors) {
      // Greatest damage on the lethal tick takes the one bounty. Equal damage
      // uses the fixed seat order, independent of packet and unit array order.
      unit.killedBy = [...contributors.keys()].sort((a, b) =>
        contributors.get(b)! - contributors.get(a)! || TEAMS.indexOf(a) - TEAMS.indexOf(b))[0];
    }
  }
  const fallen = new Set<Team>();
  const bases = battle.bases?.map(base => {
    const amount = damage.get(base.id);
    if (!amount) return base;
    const hp = Math.max(0, base.hp - amount);
    if (!hp) fallen.add(base.team);
    return { ...base, hp, lastHitTick: tick };
  });
  if (fallen.size) {
    for (const unit of units) if (unit.hp && fallen.has(unit.team)) { unit.hp = 0; unit.lastHitTick = tick; }
  }
  return new Battle(tick, units, fallen.size ? arrows.filter(a => !fallen.has(a.team)) : arrows, bases);
}

export function battleOutcome(battle: Battle): Outcome | null {
  if (battle.bases) {
    const standing = battle.bases.filter(base => base.hp > 0);
    return standing.length > 1 ? null : standing[0]?.team ?? "draw";
  }
  let survivor: Team | undefined;
  for (const unit of battle.units) {
    if (unit.hp <= 0) continue;
    if (survivor && survivor !== unit.team) return null;
    survivor = unit.team;
  }
  if (!survivor) return "draw";
  return battle.arrows.some(arrow => arrow.team !== survivor) ? null : survivor;
}
