export const TICKS_PER_SECOND = 60;
export const ARENA = { width: 960, height: 360 } as const;

export const WARRIOR = {
  maxHp: 30,
  damage: 10,
  cooldownTicks: 30,
  speed: 90,
  reach: 48, // Distance between the two Warrior centers, in arena units.
} as const;

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

export function createBattle(placements: readonly Placement[]): Battle {
  const ids = new Set(placements.map((unit) => unit.id));
  if (ids.size !== placements.length) {
    throw new Error("Each Warrior needs a unique ID.");
  }

  return {
    tick: 0,
    warriors: placements.map((unit) => ({
      ...unit, hp: WARRIOR.maxHp, nextAttackTick: 1, lastHitTick: null,
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
    if (distance > WARRIOR.reach) {
      const travel = Math.min(WARRIOR.speed / TICKS_PER_SECOND, distance - WARRIOR.reach);
      next.x += (dx / distance) * travel;
      next.y += (dy / distance) * travel;
    } else if (tick >= warrior.nextAttackTick) {
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
