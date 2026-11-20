export const TICKS_PER_SECOND = 60;
export const ARENA = { width: 960, height: 360 } as const;

export const WARRIOR = {
  radius: 11,
  maxHp: 30,
  damage: 10,
  cooldownTicks: 30,
  speed: 90,
  reach: 48, // Distance between the two Warrior centers, in arena units.
} as const;

const DIAMETER = 2 * WARRIOR.radius;
const WALK_STEP = WARRIOR.speed / TICKS_PER_SECOND;

export type Team = "red" | "blue";
export type Outcome = Team | "draw";

export interface Placement {
  id: number;
  team: Team;
  x: number;
  y: number;
}

export interface Warrior extends Placement {
  hp: number;
  nextAttackTick: number;
  lastHitTick: number | null;
}

export interface Battle {
  tick: number;
  warriors: Warrior[];
}

export function boundCenter(value: number, extent: number): number {
  return Math.max(WARRIOR.radius, Math.min(extent - WARRIOR.radius, value));
}

export function createBattle(placements: readonly Placement[]): Battle {
  const ids = new Set(placements.map((unit) => unit.id));
  if (ids.size !== placements.length) {
    throw new Error("Each Warrior needs a unique ID.");
  }

  return {
    tick: 0,
    warriors: placements.map((unit) => ({
      ...unit, x: boundCenter(unit.x, ARENA.width), y: boundCenter(unit.y, ARENA.height),
      hp: WARRIOR.maxHp, nextAttackTick: 1, lastHitTick: null,
    })),
  };
}

export function createDuel(): Battle {
  return createBattle([
    { id: 1, team: "red", x: 210, y: ARENA.height / 2 },
    { id: 2, team: "blue", x: ARENA.width - 210, y: ARENA.height / 2 },
  ]);
}

function nearestEnemy(warrior: Warrior, units: readonly Warrior[]): Warrior | undefined {
  let closest: Warrior | undefined;
  let closestDistance = Infinity;
  for (const unit of units) {
    if (unit.team === warrior.team || unit.hp <= 0) continue;
    const distance = (unit.x - warrior.x) ** 2 + (unit.y - warrior.y) ** 2;
    if (!closest || distance < closestDistance || (distance === closestDistance && unit.id < closest.id)) {
      closest = unit;
      closestDistance = distance;
    }
  }
  return closest;
}

function separateFootprints(previous: readonly Warrior[], next: Warrior[]) {
  const push = next.map(() => ({ x: 0, y: 0 }));
  let overlapping = false;
  for (let i = 0; i < next.length; i++) {
    const a = next[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < next.length; j++) {
      const b = next[j];
      if (b.hp <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const squared = dx * dx + dy * dy;
      if (squared >= DIAMETER * DIAMETER) continue;
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
      const halfOverlap = (DIAMETER - distance) / 2;
      push[i].x -= nx * halfOverlap;
      push[i].y -= ny * halfOverlap;
      push[j].x += nx * halfOverlap;
      push[j].y += ny * halfOverlap;
    }
  }

  // Apply all pair corrections together. A crowded Warrior still moves at walking speed.
  for (const [i, unit] of next.entries()) {
    if (unit.hp <= 0) continue;
    const from = previous[i];
    const dx = unit.x - from.x + push[i].x;
    const dy = unit.y - from.y + push[i].y;
    const distance = Math.hypot(dx, dy);
    const fraction = distance > WALK_STEP ? WALK_STEP / distance : 1;
    unit.x = boundCenter(from.x + dx * fraction, ARENA.width);
    unit.y = boundCenter(from.y + dy * fraction, ARENA.height);
  }
  return overlapping;
}

export function stepBattle(battle: Battle): Battle {
  const tick = battle.tick + 1;
  const damage = new Map<number, number>();

  // Every Warrior sees the same starting positions and health for this tick.
  const warriors = battle.warriors.map((warrior) => {
    const next = { ...warrior };
    if (warrior.hp <= 0) return next;
    const target = nearestEnemy(warrior, battle.warriors);
    if (!target) return next;

    const dx = target.x - warrior.x;
    const dy = target.y - warrior.y;
    const distance = Math.hypot(dx, dy);
    if (distance > DIAMETER) {
      const travel = Math.min(WALK_STEP, distance - DIAMETER);
      next.x += (dx / distance) * travel;
      next.y += (dy / distance) * travel;
    }
    if (distance <= WARRIOR.reach && tick >= warrior.nextAttackTick) {
      damage.set(target.id, (damage.get(target.id) ?? 0) + WARRIOR.damage);
      next.nextAttackTick = tick + WARRIOR.cooldownTicks;
    }
    return next;
  });

  for (const warrior of warriors) {
    const amount = damage.get(warrior.id);
    if (amount === undefined) continue;
    warrior.hp = Math.max(0, warrior.hp - amount);
    warrior.lastHitTick = tick;
  }
  // A second neighbor can push a Warrior back into the first. Relax short chains.
  for (let pass = 0; pass < 4; pass++) {
    if (!separateFootprints(battle.warriors, warriors)) break;
  }
  return { tick, warriors };
}

export function battleOutcome(battle: Battle): Outcome | null {
  const redAlive = battle.warriors.some((unit) => unit.team === "red" && unit.hp > 0);
  const blueAlive = battle.warriors.some((unit) => unit.team === "blue" && unit.hp > 0);
  if (redAlive && blueAlive) return null;
  if (redAlive) return "red";
  if (blueAlive) return "blue";
  return "draw";
}
