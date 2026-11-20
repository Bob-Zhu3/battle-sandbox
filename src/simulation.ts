import { applyMagic, blownAway, pulses, SPELLS, type FieldSpell } from "./spells.ts";
import { catchBarrel, chainLightning, finishBuilding, giantTurn } from "./encounters.ts";
import { aimTower, facesShot, incomingShot } from "./defense.ts";
import { finishTreatments, medicDuty } from "./medic.ts";
import { nearestEnemy } from "./targeting.ts";
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
  makerId?: number;
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
  fearId?: number;
  frightUntil?: number;
  lastSqueakTick?: number;
  barrel?: {since: number; dx: number; dy: number; damage: number};
  droppedBarrel?: {x: number; y: number; tick: number; side: number};
  arc?: {tick: number; path: {x: number; y: number}[]};
  runUp?: number;
  lastChargeTick?: number;
  stunnedUntil?: number;
  burstLeft?: number;
  nextBurstTick?: number;
  emberUntil?: number;
  reborn?: boolean;
  lastHatchTick?: number;
  constructingSince?: number;
  builtCount?: number;
  lastSpawnTick?: number;
  lastBraceTick?: number;
  lastBlockTick?: number;
  wrappingSince?: number;
  aidReadyTick?: number;
  lastHealTick?: number;
  lastTreatedTick?: number;
}

export type Warrior = Unit & { kind: "warrior" };

export class Battle {
  tick: number;
  units: Unit[];
  arrows: Arrow[];
  bases?: Base[];
  spells?: FieldSpell[];

  constructor(tick: number, units: Unit[], arrows: Arrow[], bases?: Base[], spells?: FieldSpell[]) {
    this.tick = tick;
    this.units = units;
    this.arrows = arrows;
    this.bases = bases;
    if (spells?.length) this.spells = spells;
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
function moveToward(unit: Unit, x: number, y: number, stopAt: number) {
  const dx = x - unit.x, dy = y - unit.y;
  const distance = Math.hypot(dx, dy);
  unit.aimX = distance > 0 ? dx / distance : ARMIES[unit.team].facing;
  unit.aimY = distance > 0 ? dy / distance : 0;
  if (distance > stopAt) {
    const step = Math.min(UNIT_DEFINITIONS[unit.kind].speed / TICKS_PER_SECOND, distance - stopAt);
    unit.x += unit.aimX * step;
    unit.y += unit.aimY * step;
  }
  return distance;
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
    if ((ally.kind !== "warrior" && ally.kind !== "shieldbearer") || ally.team !== archer.team || ally.hp <= 0) return false;
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
  let arrows: Arrow[] = [];
  const stuns = new Map<number, number>();
  const braces = new Set<number>();
  const healing = new Map<number, number>();
  const activeMagic = battle.spells?.filter(spell => pulses(spell, tick)) ?? [];
  const winds = activeMagic.filter(spell => spell.kind === "gust");
  const towers = battle.bases?.map(base => aimTower(base, battle.units, tick, TICKS_PER_SECOND, arrows));
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
    if (unit.emberUntil !== undefined) {
      if (tick >= unit.emberUntil) {
        delete next.emberUntil;
        next.hp = Math.ceil(UNIT_DEFINITIONS.phoenix.maxHp / 2);
        next.lastHatchTick = tick;
      } else return next;
    }
    if (tick < (unit.stunnedUntil ?? 0)) return next;
    if (unit.kind === "giant" && giantTurn(next, battle.units, tick, arrows, TICKS_PER_SECOND)) return next;
    const target = nearestEnemy(unit, targets);
    if (unit.kind === "drone" && unit.burstLeft && tick >= (unit.nextBurstTick ?? 0) && unit.attackDirection) {
      const spec = UNIT_DEFINITIONS.drone, speed = spec.arrowSpeed / TICKS_PER_SECOND;
      arrows.push({kind: "dart", team: unit.team, x: unit.x, y: unit.y, vx: unit.attackDirection.x * speed,
        vy: unit.attackDirection.y * speed, releasedTick: tick, damage: spec.damage});
      next.burstLeft = unit.burstLeft - 1; next.nextBurstTick = tick + spec.burstGap;
    }
    if (unit.kind === "workshop") {
      next.targetId = target?.id ?? null;
      if (target && (unit.builtCount ?? 0) < UNIT_DEFINITIONS.workshop.capacity &&
          tick - (unit.lastSpawnTick ?? -Infinity) >= UNIT_DEFINITIONS.workshop.cooldownTicks) {
        next.constructingSince ??= tick;
      } else delete next.constructingSince;
      return next;
    }
    if (unit.kind === "engineer" && !unit.builtCount && target) {
      next.targetId = target.id;
      const distance = moveToward(next, target.x, target.y, UNIT_DEFINITIONS.engineer.buildRange - 4);
      if (distance <= UNIT_DEFINITIONS.engineer.buildRange) next.constructingSince ??= tick;
      else delete next.constructingSince;
      return next;
    }
    if (unit.kind === "engineer" && !target) delete next.constructingSince;
    if (unit.kind === "medic" || unit.kind === "engineer") {
      const duty = medicDuty(unit, battle.units, target, tick);
      delete next.wrappingSince;
      if (duty) {
        next.targetId = duty.ally.id;
        const distance = moveToward(next, duty.x, duty.y, duty.stopAt);
        if (duty.treating && distance <= UNIT_DEFINITIONS.medic.aidReach) {
          next.wrappingSince = unit.targetId === duty.ally.id ? unit.wrappingSince ?? tick : tick;
        } else if (!duty.treating && distance <= duty.stopAt && target) {
          const dx = target.x - next.x, dy = target.y - next.y;
          const length = Math.hypot(dx, dy) || 1;
          next.aimX = dx / length; next.aimY = dy / length;
        }
        return next;
      }
    }
    next.targetId = target?.id ?? null;
    if (!target) return next;

    const definition = UNIT_DEFINITIONS[unit.kind];
    const reach = definition.reach + (target.kind === "base" ? BASE_RADIUS : 0);
    const targetRadius = target.kind === "base" ? BASE_RADIUS : UNIT_DEFINITIONS[target.kind].radius;
    const stopAt = definition.attack === "melee" ? definition.radius + targetRadius : reach;
    const distance = moveToward(next, target.x, target.y, stopAt);
    if (distance <= reach && tick >= unit.nextAttackTick) {
      next.nextAttackTick = tick + definition.cooldownTicks;
      next.lastAttackTick = tick;
      next.attackDirection = { x: next.aimX, y: next.aimY };
      if (definition.attack === "melee") {
        let amount: number = definition.damage;
        if (unit.kind === "lancer" && (unit.runUp ?? 0) >= UNIT_DEFINITIONS.lancer.runUp) {
          next.runUp = 0; next.lastChargeTick = tick;
          const braced = target.kind === "shieldbearer" && target.aimX * next.aimX + target.aimY * next.aimY <= -0.5;
          if (braced) { stuns.set(unit.id, tick + 18); braces.add(target.id); }
          else amount += UNIT_DEFINITIONS.lancer.bonus;
        }
        hit(target, amount, unit.team);
      } else if (definition.attack === "lightning") {
        chainLightning(next, target, battle.units, tick, hit);
      } else if (definition.attack === "arrow") {
        if (shootingPastCover(next, battle.units, distance)) next.lastAttentionTick = tick;
        const step = definition.arrowSpeed / TICKS_PER_SECOND;
        if (unit.kind === "drone") { next.burstLeft = 2; next.nextBurstTick = tick + UNIT_DEFINITIONS.drone.burstGap; }
        arrows.push({
          ...(unit.kind === "cooper" ? {kind: "barrel" as const} : unit.kind === "drone" || unit.kind === "post" ? {kind: "dart" as const} : {}),
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
  applyMagic(activeMagic, units, targets, tick, hit, healing);
  const byId = new Map(units.map(unit => [unit.id, unit]));
  for (const [i, unit] of units.entries()) {
    if (unit.fearId !== undefined && battle.units[i].fearId !== unit.fearId) {
      const mouse = byId.get(unit.fearId);
      if (mouse) mouse.lastSqueakTick = tick;
    }
  }
  for (const [id, until] of stuns) byId.get(id)!.stunnedUntil = until;
  for (const id of braces) byId.get(id)!.lastBlockTick = tick;
  if (winds.length) arrows = arrows.filter(arrow => !blownAway(arrow, winds));
  for (const unit of units) {
    if (unit.kind === "shieldbearer" && unit.hp > 0 && incomingShot(unit, battle.arrows)) unit.lastBraceTick = tick;
  }
  const movedTargets = battle.bases ? [...units, ...battle.bases] : units;
  for (const arrow of battle.arrows) {
    if (winds.length && blownAway(arrow, winds)) continue;
    if (arrow.kind !== "barrel") noticeFriendlyArrow(arrow, units, tick);
    const impact = firstArrowImpact(arrow, targets, movedTargets);
    if (impact) {
      if (impact.kind === "giant" && catchBarrel(byId.get(impact.id)!, arrow, tick)) continue;
      const guard = impact.kind === "shieldbearer" && arrow.kind !== "barrel" ? byId.get(impact.id) : undefined;
      if (guard && facesShot(guard, arrow)) {
        guard.lastBraceTick = guard.lastBlockTick = tick;
        hit(impact, Math.ceil(arrow.damage * UNIT_DEFINITIONS.shieldbearer.damageFraction), arrow.team);
      } else hit(impact, arrow.damage, arrow.team);
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
    unit.pace += ((speed ? Math.min(1, distance / speed) : 0) - unit.pace) * .3;
    if (unit.kind === "lancer" && unit.lastChargeTick !== tick) {
      const straight = unit.aimX * from.aimX + unit.aimY * from.aimY > 0.93;
      unit.runUp = distance > 0.15 && straight && tick >= (unit.stunnedUntil ?? 0) ? Math.min(60, (from.runUp ?? 0) + Math.min(distance, speed)) : 0;
    }
    const amount = damage.get(unit.id);
    if (amount === undefined) continue;
    unit.hp = Math.max(0, unit.hp - amount);
    unit.lastHitTick = tick;
    if (!unit.hp && unit.kind === "phoenix" && !unit.reborn) {
      unit.hp = 1; unit.reborn = true; unit.emberUntil = tick + UNIT_DEFINITIONS.phoenix.hatchTicks;
      unit.targetId = null; unit.pace = 0;
    }
    const contributors = sources.get(unit.id);
    if (!unit.hp && contributors) {
      // Greatest damage on the lethal tick takes the one bounty. Equal damage
      // uses the fixed seat order, independent of packet and unit array order.
      unit.killedBy = [...contributors.keys()].sort((a, b) =>
        contributors.get(b)! - contributors.get(a)! || TEAMS.indexOf(a) - TEAMS.indexOf(b))[0];
    }
  }
  const fallen = new Set<Team>();
  const bases = towers?.map(base => {
    const amount = damage.get(base.id);
    if (!amount) return base;
    const hp = Math.max(0, base.hp - amount);
    if (!hp) fallen.add(base.team);
    return { ...base, hp, lastHitTick: tick };
  });
  if (fallen.size) {
    for (const unit of units) if (unit.hp && fallen.has(unit.team)) { unit.hp = 0; unit.lastHitTick = tick; }
  }
  finishTreatments(units, byId, tick, healing);
  const recruits: Placement[] = [];
  for (const unit of units) {
    const child = finishBuilding(unit, tick);
    if (child) recruits.push(child);
  }
  if (recruits.length) units.push(...createBattle(recruits).units);
  const spells = battle.spells?.filter(spell => tick - spell.startTick < SPELLS[spell.kind].duration && !fallen.has(spell.team));
  return new Battle(tick, units, fallen.size ? arrows.filter(a => !fallen.has(a.team)) : arrows, bases, spells);
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
