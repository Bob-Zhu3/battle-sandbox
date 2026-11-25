import { collectSouls, hasSoul, hunt, resolveConversions, type Conversion, type Harvest, type Hex } from "./transformations.ts";
import { advanceTunnel, digFromHome, diveWorm, type Tunnel } from "./tunnels.ts";
import { followWormHead, initialWormBody } from "./sandworm.ts";
import { recordTrail, type TrailMark } from "./trails.ts";
import { applyMagic, blownAway, prepareFieldMagic, pulses, SPELLS, floorAfterCast, type SpellMark, type FieldSpell } from "./spells.ts";
import { transportEnemies } from "./wormhole.ts";
import { reflectAtWards } from "./mirror.ts";
import { channelPrism, focusLens, pickTowerTarget } from "./siege.ts";
import { applyRage, strikeField } from "./battle-magic.ts";
import { finishBuilding, resolveControl, startCyclopsSwing, type Windup } from "./encounters.ts";
import { afflict, disabledUntil, displace, effectLifetime, moveKnockback, shove, stun, tickAfflictions, type Affliction, type GroundEffect } from "./conditions.ts";
import { aimTower, incomingShot } from "./defense.ts";
import { finishTreatments, medicDuty } from "./medic.ts";
import { nearestEnemy } from "./targeting.ts";
import type { Arrow } from "./arrows.ts";
import { advanceShot, applyClouds, deflectHead, releaseShot } from "./shots.ts";
import { currentUnitKind, footprint, isHuman, UNIT_DEFINITIONS, type UnitKind } from "./units.ts";
import { continueFlurry, eruptWorm, releaseTelegraph, rosterStrike, rosterTarget, startTelegraph, type Impulse } from "./roster-attacks.ts";
import { settleTroopBodies } from "./roster-life.ts";
import { blowFan, firstFanContact, type FanContact } from "./windmill.ts";
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
  flurryStartedTick?: number;
  attackDirection: { x: number; y: number } | null;
  // Archer peeking past cover, or Warrior hearing a friendly shaft pass behind.
  lastAttentionTick: number | null;
  killedBy?: Team;
  lastStartleTick?: number;
  lastSqueakTick?: number;
  windup?: Windup;
  lastSmashTick?: number;
  nextSwallowTick?: number;
  lastSwallow?: { tick: number; team: Team; kind: UnitKind };
  swallowedTick?: number;
  slowUntil?: number;
  rootedUntil?: number;
  frozenUntil?: number;
  frozenAt?: number;
  raging?: boolean;
  drawingBow?: boolean;
  lastDrawTick?: number;
  lastChargeReadyTick?: number;
  focusSince?: number;
  prismSides?: number[];
  fogUntil?: number;
  beam?: {tick: number; x: number; y: number; level: number};
  burn?: Affliction;
  poison?: Affliction;
  zombified?: { kind: UnitKind; team: Team; tick: number };
  hex?: Hex;
  soul?: { x: number; y: number; tick: number };
  tunnel?: Tunnel;
  wormBody?: {x: number; y: number}[];
  emergedTick?: number;
  trail?: TrailMark[];
  knockback?: { x: number; y: number; ticks: number };
  arc?: {tick: number; path: {x: number; y: number}[]};
  grab?: {tick: number; targets: {id: number; x: number; y: number}[]};
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
  lastKickTick?: number;
  openedTick?: number;
  heads?: number;
  hydraWounds?: number;
  smallSlime?: boolean;
  splitTick?: number;
  siblingId?: number;
  wolfUntil?: number;
  wolfReadyTick?: number;
  headUntil?: number;
  headSpot?: { x: number; y: number };
  headLandedTick?: number;
  spareUsed?: boolean;
  snowStock?: number;
  repackAt?: number;
  millFastUntil?: number;
  groundedUntil?: number;
  petrifiedUntil?: number;
  warpedTick?: number;
}

export type Warrior = Unit & { kind: "warrior" };

export class Battle {
  tick: number;
  units: Unit[];
  arrows: Arrow[];
  bases?: Base[];
  spells?: FieldSpell[];
  marks?: SpellMark[];
  effects?: GroundEffect[];

  constructor(tick: number, units: Unit[], arrows: Arrow[], bases?: Base[], spells?: FieldSpell[], effects?: GroundEffect[], marks?: SpellMark[]) {
    this.tick = tick;
    this.units = units;
    this.arrows = arrows;
    this.bases = bases;
    if (spells?.length) this.spells = spells;
    if (effects?.length) this.effects = effects;
    if (marks?.length) this.marks = marks;
  }

  // Preserve the Warrior-only view used by the original Node callers.
  get warriors(): Warrior[] {
    return this.units.filter((unit): unit is Warrior => unit.kind === "warrior");
  }
}

export function boundCenter(value: number, extent: number, radius: number = WARRIOR.radius): number {
  return Math.max(radius, Math.min(extent - radius, value));
}

export function createBattle(placements: readonly (Omit<Placement,"kind"> & { kind?: UnitKind | "wrestler" })[], tick = 0, bases?: Base[]): Battle {
  const ids = new Set(placements.map((unit) => unit.id));
  if (ids.size !== placements.length) {
    throw new Error("Each unit needs a unique ID.");
  }

  const units = placements.map((placement) => {
    const kind = currentUnitKind(placement.kind) ?? "warrior";
    const { radius, maxHp } = UNIT_DEFINITIONS[kind];
    const unit: Unit = {
      ...placement, kind, x: boundCenter(placement.x, ARENA.width, radius), y: boundCenter(placement.y, ARENA.height, radius),
      hp: maxHp, nextAttackTick: 1, lastHitTick: null,
      targetId: null, aimX: ARMIES[placement.team].facing, aimY: 0,
      walkDistance: 0, pace: 0, lastAttackTick: null, attackDirection: null, lastAttentionTick: null,
    };
    if (kind === "miner") digFromHome(unit, tick, TICKS_PER_SECOND, bases?.find(base => base.team === unit.team));
    if (kind === "sandworm") unit.wormBody = initialWormBody(unit);
    return unit;
  });
  return new Battle(tick, units, [], bases);
}

export function createDuel(): Battle {
  return createBattle([
    { id: 1, team: "red", x: 210, y: ARENA.height / 2 },
    { id: 2, team: "blue", x: ARENA.width - 210, y: ARENA.height / 2 },
  ]);
}

export type Target = Unit | Base;
function walkSpeed(unit: Unit) {
  const stride=unit.kind==="werewolf" && unit.wolfUntil!==undefined ? 1.45 : unit.smallSlime && unit.kind==="slime" ? 1.18 : 1;
  return UNIT_DEFINITIONS[unit.kind].speed * stride * (unit.raging ? SPELLS.rage.speedFactor : 1);
}
function moveToward(unit: Unit, x: number, y: number, stopAt: number) {
  const dx = x - unit.x, dy = y - unit.y;
  const distance = Math.hypot(dx, dy);
  unit.aimX = distance > 0 ? dx / distance : ARMIES[unit.team].facing;
  unit.aimY = distance > 0 ? dy / distance : 0;
  if (distance > stopAt && unit.rootedUntil === undefined) {
    const speedFactor = unit.slowUntil === undefined ? 1 : UNIT_DEFINITIONS.frostqueen.speedFactor;
    const step = Math.min(walkSpeed(unit) * speedFactor / TICKS_PER_SECOND, distance - stopAt);
    if (unit.kind === "sandworm") {
      const sway = .48 * Math.sin(unit.walkDistance / 13 + unit.id * 2.4) * Math.min(1, (distance - stopAt) / 35);
      const heading = Math.atan2(dy, dx) + sway;
      unit.aimX = Math.cos(heading); unit.aimY = Math.sin(heading);
    }
    unit.x += unit.aimX * step;
    unit.y += unit.aimY * step;
  }
  // A diagonal step can land a fraction of a pixel outside reach with no representable movement left.
  return Math.abs(distance - stopAt) < 1e-8 ? stopAt : distance;
}

// At this cell width, overlapping circles can only occupy the same cell or
// adjacent cells. Rebuild after each separation pass because bodies move.
const contactCell = 2 * Math.max(...Object.values(UNIT_DEFINITIONS).map(def => def.radius));
const contactCols = Math.ceil(ARENA.width / contactCell);
const contactRows = Math.ceil(ARENA.height / contactCell);

function contactNeighborhoods(units: readonly Unit[], solid: readonly boolean[]) {
  const cells: number[][] = Array.from({length: contactCols * contactRows}, () => []);
  const homes = new Int32Array(units.length);
  for (let i = 0; i < units.length; i++) {
    if (!solid[i]) continue;
    const col = Math.max(0, Math.min(contactCols - 1, Math.floor(units[i].x / contactCell)));
    const row = Math.max(0, Math.min(contactRows - 1, Math.floor(units[i].y / contactCell)));
    homes[i] = row * contactCols + col;
    // Append in the original pair order to preserve floating-point sums on replay.
    for (let y = Math.max(0, row - 1); y <= Math.min(contactRows - 1, row + 1); y++) {
      for (let x = Math.max(0, col - 1); x <= Math.min(contactCols - 1, col + 1); x++) cells[y * contactCols + x].push(i);
    }
  }
  return {cells, homes};
}

function separateFootprints(previous: readonly Unit[], next: Unit[], solid: readonly boolean[]) {
  const push = next.map(() => ({ x: 0, y: 0 }));
  const grid = next.length >= 64 ? contactNeighborhoods(next, solid) : undefined;
  let overlapping = false;
  for (let i = 0; i < next.length; i++) {
    const a = next[i];
    if (!solid[i]) continue;
    const neighbors = grid?.cells[grid.homes[i]];
    const count = neighbors ? neighbors.length : next.length;
    for (let index = neighbors ? 0 : i + 1; index < count; index++) {
      const j = neighbors ? neighbors[index] : index;
      if (j <= i) continue;
      const b = next[j];
      if (!solid[j]) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const squared = dx * dx + dy * dy;
      const touching = footprint(a) + footprint(b);
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
    const radius = footprint(unit);
    const walkStep = unit.rootedUntil === undefined && unit.frozenUntil === undefined ? walkSpeed(unit) / TICKS_PER_SECOND : 0;
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
  const effects = (battle.effects ?? []).filter(e => tick - e.tick < effectLifetime(e));
  const burns: {id: number; team: Team}[] = [];
  const conversions: Conversion[] = [];
  const cuts: Harvest[] = [];
  const braces = new Set<number>();
  const healing = new Map<number, number>();
  const impulses: Impulse[] = [];
  // A portal tests the last movement interval before both mouths expire.
  const spells = battle.spells?.filter(s => s.kind==="wormhole" ? s.entrance && tick-s.startTick<=SPELLS.wormhole.duration : tick-s.startTick<SPELLS[s.kind].duration)
    .map(s => s.kind==="wormhole" || s.kind==="mirror" || (s.kind==="lightning" && pulses(s,tick)) ? {...s} : s);
  const activeMagic = spells?.filter(spell => spell.kind!=="wormhole" && pulses(spell, tick)) ?? [];
  const strikes = activeMagic.filter(s => s.kind === "freeze" || s.kind === "lightning");
  const rings = spells?.filter(s => s.kind === "rage" && tick-s.startTick >= SPELLS.rage.delay) ?? [];
  const winds = activeMagic.filter(spell => spell.kind === "gust");
  const fieldChanges = activeMagic.filter(s => s.kind === "briar" || s.kind === "fault" || s.kind === "rain");
  const readyToDive = (u: Unit) => u.hp > 0 && u.kind === "sandworm" && u.windup?.kind === "breach" && tick-u.windup.since >= UNIT_DEFINITIONS.sandworm.windup;
  const diving = battle.units.some(readyToDive);
  const starting = diving || fieldChanges.length || strikes.length || rings.length || battle.units.some(u => u.hp > 0 && (u.raging || u.groundedUntil===tick)) ? battle.units.map(u => {
    if (!u.hp) return u;
    const ready = {...u};
    if ((ready.groundedUntil ?? Infinity)<=tick) delete ready.groundedUntil;
    if (fieldChanges.length) prepareFieldMagic(ready,fieldChanges,tick);
    return ready;
  }) : battle.units;
  const basesAtStart = strikes.length ? battle.bases?.map(b => ({...b})) : battle.bases;
  const targets: readonly Target[] = basesAtStart ? [...starting, ...basesAtStart] : starting;
  function hit(target: Target, amount: number, team: Team) {
    damage.set(target.id, (damage.get(target.id) ?? 0) + amount);
    if (!battle.bases || target.kind === "base") return;
    const contributors = sources.get(target.id) ?? new Map<Team, number>();
    contributors.set(team, (contributors.get(team) ?? 0) + amount);
    sources.set(target.id, contributors);
  }

  for (const spell of strikes) strikeField(spell,targets,tick,hit);
  for (const u of starting) if (u.hp && (rings.length || u.raging)) applyRage(u,rings,tick);
  const control = resolveControl(starting, targets, tick, hit, effects);
  if (diving) for (const worm of starting) {
    if (!readyToDive(worm) || disabledUntil(worm)>tick || control.stuns.has(worm.id)) continue;
    if ((worm.rootedUntil ?? 0)>tick) delete worm.windup;
    else diveWorm(worm,tick,TICKS_PER_SECOND);
  }
  const towers = basesAtStart?.map(base => {
    const until = Math.max(base.stunnedUntil ?? 0, control.stuns.get(base.id) ?? 0);
    if (tick < until) return {...base, stunnedUntil: until, acquiredTick: null, targetId: null};
    if (tick < (base.frozenUntil ?? 0)) return {...base, acquiredTick: null, targetId: null};
    return aimTower(base, starting, tick, TICKS_PER_SECOND, arrows);
  });

  // Movement, targeting and releases all start from the same snapshot.
  const units = starting.map((unit) => {
    const next = { ...unit };
    if (unit.hp <= 0) return next;
    if (unit.tunnel) {
      advanceTunnel(next,tick);
      if (next.kind === "sandworm" && next.emergedTick === tick) eruptWorm(next,targets,tick,hit,effects,impulses);
      return next;
    }
    if (unit.emergedTick === tick) return next;
    if (next.slowUntil !== undefined && tick >= next.slowUntil) delete next.slowUntil;
    if (next.fogUntil !== undefined && tick >= next.fogUntil) delete next.fogUntil;
    if (next.rootedUntil !== undefined && tick >= next.rootedUntil) delete next.rootedUntil;
    if (next.frozenUntil !== undefined && tick >= next.frozenUntil) { delete next.frozenUntil; delete next.frozenAt; }
    if ((next.wolfUntil ?? Infinity)<=tick) delete next.wolfUntil;
    if ((next.petrifiedUntil ?? Infinity)<=tick) delete next.petrifiedUntil;
    if (unit.kind==="snowman" && (unit.repackAt ?? Infinity)<=tick) {
      next.snowStock=Math.min(3,(unit.snowStock ?? 3)+1);
      if (next.snowStock<3) next.repackAt=tick+UNIT_DEFINITIONS.snowman.repackTicks;
      else delete next.repackAt;
    }
    if (unit.emberUntil !== undefined) {
      if (tick >= unit.emberUntil) {
        delete next.emberUntil;
        next.hp = Math.ceil(UNIT_DEFINITIONS.phoenix.maxHp / 2);
        next.lastHatchTick = tick;
      } else return next;
    }
    const arc = control.arcs.get(unit.id);
    if (arc) {
      const dx = arc.path[1].x - unit.x, dy = arc.path[1].y - unit.y, length = Math.hypot(dx, dy) || 1;
      next.arc = arc; next.aimX = dx / length; next.aimY = dy / length;
      next.attackDirection = {x: next.aimX, y: next.aimY};
      next.targetId = nearestEnemy(unit, targets)!.id;
      next.lastAttackTick = tick; next.nextAttackTick = tick + UNIT_DEFINITIONS.kirin.cooldownTicks;
    }
    if (control.mice.has(unit.id)) next.lastStartleTick = tick;
    if (control.swallowed.has(unit.id)) { next.swallowedTick = tick; return next; }
    if (control.finished.has(unit.id)) {
      delete next.windup;
      if (unit.windup!.kind === "smash") {
        next.lastSmashTick = next.lastAttackTick = tick;
        next.nextAttackTick = tick + UNIT_DEFINITIONS.cyclops.cooldownTicks;
      } else {
        const meal = control.meals.get(unit.id);
        next.nextSwallowTick = tick + (meal ? UNIT_DEFINITIONS.cyclops.swallowCooldown : 12);
        if (meal) next.lastSwallow = {tick, team: meal.team, kind: meal.kind};
      }
    }
    const interruptedUntil = Math.max(control.stuns.get(unit.id) ?? 0, next.stunnedUntil ?? 0);
    if (control.gaze.stone.has(unit.id)) next.petrifiedUntil=tick+UNIT_DEFINITIONS.medusa.stoneTicks;
    if (tick < interruptedUntil) {
      stun(next, interruptedUntil);
      return next;
    }
    if (next.frozenUntil !== undefined) return next;
    if (unit.kind==="monk" && continueFlurry(next,targets,tick,hit)) return next;
    if (arc || unit.windup) {
      releaseTelegraph(next,targets,tick,control.gaze.fired.has(unit.id),hit,effects,burns);
      return next;
    }
    if (unit.kind==="horseman" && unit.headUntil!==undefined) {
      if (unit.headSpot && unit.headLandedTick!==undefined) {
        const head=unit.headSpot;
        const distance=moveToward(next,head.x,head.y,5);
        if (distance<=footprint(unit)+3) {
          delete next.headUntil; delete next.headSpot; delete next.headLandedTick;
        } else if (tick-unit.headLandedTick>=UNIT_DEFINITIONS.horseman.returnTicks) {
          const roll=Math.min(2.5,distance);
          next.headSpot={x:head.x-next.aimX*roll,y:head.y-next.aimY*roll};
        }
      }
      return next;
    }
    if (unit.kind==="slime" && unit.smallSlime && unit.siblingId!==undefined && tick-(unit.splitTick ?? tick)>=UNIT_DEFINITIONS.slime.mergeDelay) {
      const other=starting.find(u=>u.id===unit.siblingId && u.team===unit.team && u.kind==="slime" && u.hp>0);
      if (other) { moveToward(next,other.x,other.y,14); return next; }
      delete next.siblingId;
    }
    if (unit.kind === "belltower") {
      next.targetId = control.bells.get(unit.id) ?? null;
      if (next.targetId !== null) { next.lastAttackTick = tick; next.nextAttackTick = tick+UNIT_DEFINITIONS.belltower.cooldownTicks; }
      return next;
    }
    const target = unit.kind === "lobber" || unit.kind === "sunlens" || unit.kind==="prism" || unit.kind==="windmill" ? pickTowerTarget(unit,targets) :
      (unit.kind === "reaper" && hunt(unit, targets)) || rosterTarget(unit,targets) || nearestEnemy(unit, targets);
    if (unit.kind === "sunlens") { focusLens(next,target,tick,hit); return next; }
    if (unit.kind==="prism") { channelPrism(next,target,targets,tick,hit); return next; }
    if (unit.kind==="windmill") { blowFan(next,target,targets,tick,TICKS_PER_SECOND,hit,impulses); return next; }
    if (unit.kind === "drone" && unit.burstLeft && tick >= (unit.nextBurstTick ?? 0) && unit.attackDirection) {
      const spec = UNIT_DEFINITIONS.drone, speed = spec.arrowSpeed / TICKS_PER_SECOND;
      arrows.push({kind: "dart", casterId: unit.id, team: unit.team, x: unit.x, y: unit.y, vx: unit.attackDirection.x * speed,
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
      const duty = medicDuty(unit, starting, target, tick);
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
    if (!target) { delete next.drawingBow; return next; }

    const definition = UNIT_DEFINITIONS[unit.kind];
    const reach = definition.reach + (target.kind === "base" ? BASE_RADIUS : 0);
    const targetRadius = target.kind === "base" ? BASE_RADIUS : footprint(target);
    const closesToContact = (definition.attack === "melee" && unit.kind !== "kraken") || unit.kind === "cyclops";
    const stopAt = closesToContact ? Math.min(reach,footprint(unit) + targetRadius) : reach;
    const distance = moveToward(next, target.x, target.y, stopAt);
    if (unit.kind === "archer") {
      const readyIn = next.nextAttackTick-tick;
      const drawing = distance <= reach+walkSpeed(next)*.3 && readyIn <= 18 && (readyIn>0 || distance>reach);
      if (drawing && !unit.drawingBow) next.lastDrawTick=tick;
      if (drawing) next.drawingBow=true; else delete next.drawingBow;
    }
    if (unit.kind === "cyclops") {
      startCyclopsSwing(next, starting, target, tick, distance);
      return next;
    }
    if (definition.attack !== "lightning" && distance <= reach && tick >= unit.nextAttackTick) {
      if (startTelegraph(next,target,tick)) return next;
      if (unit.kind==="snowman" && next.snowStock===0) return next;
      next.nextAttackTick = tick + definition.cooldownTicks;
      next.lastAttackTick = tick;
      next.attackDirection = { x: next.aimX, y: next.aimY };
      if (rosterStrike(next,target,targets,tick,hit,healing,impulses)) return next;
      if (definition.attack === "melee") {
        let amount: number = definition.damage;
        if (unit.kind === "lancer" && (unit.runUp ?? 0) >= UNIT_DEFINITIONS.lancer.runUp) {
          next.runUp = 0; next.lastChargeTick = tick;
          const braced = target.kind === "shieldbearer" && target.aimX * next.aimX + target.aimY * next.aimY <= -0.5;
          if (braced) { stun(next, tick + 18); braces.add(target.id); }
          else amount += UNIT_DEFINITIONS.lancer.bonus;
        }
        if (unit.kind === "zombie" && target.kind !== "base" && isHuman(target.kind)) {
          conversions.push({id: target.id, team: unit.team, casterId: unit.id, kind: "bite"});
        } else hit(target, amount, unit.team);
        if (unit.kind === "reaper" && hasSoul(target)) cuts.push({casterId: unit.id, victimId: target.id});
        if (unit.kind === "phoenix" && target.kind !== "base") burns.push({id: target.id, team: unit.team});
      } else if (definition.attack === "arrow") {
        if (unit.kind==="snowman") {
          next.snowStock=(next.snowStock ?? 3)-1;
          next.repackAt ??= tick+UNIT_DEFINITIONS.snowman.repackTicks;
        }
        if (unit.kind==="horseman") next.headUntil=tick+Math.max(1,Math.ceil(distance*TICKS_PER_SECOND/UNIT_DEFINITIONS.horseman.arrowSpeed));
        if (unit.kind === "archer" && shootingPastCover(next, starting, distance)) next.lastAttentionTick = tick;
        if (unit.kind === "drone") { next.burstLeft = 2; next.nextBurstTick = tick + UNIT_DEFINITIONS.drone.burstGap; }
        arrows.push(releaseShot(next, target, tick, TICKS_PER_SECOND));
      }
    }
    return next;
  });

  // A lethal melee hit frees the footprint immediately, as in the original duel.
  // Arrows below use the resulting movement paths and the starting list of living enemies.
  const solid = units.map((unit,i) => !starting[i].tunnel && unit.hp > (damage.get(unit.id) ?? 0));
  for (let pass = 0; pass < 4; pass++) {
    if (!separateFootprints(starting, units, solid)) break;
  }
  const byId = new Map(units.map(unit => [unit.id, unit]));
  for (const mouseId of control.mice.values()) byId.get(mouseId)!.lastSqueakTick = tick;
  for (const id of braces) byId.get(id)!.lastBlockTick = tick;
  for (const [id, impacts] of control.shocks) {
    const target = byId.get(id)!;
    for (const point of impacts) shove(target, point.x, point.y, point.distance);
  }
  for (const impulse of impulses) displace(byId.get(impulse.id)!,impulse.dx,impulse.dy);
  for (const unit of units) moveKnockback(unit);
  for (const {id, team} of burns) afflict(byId.get(id)!, "burn", team, tick);
  applyMagic(activeMagic, units, targets, tick, hit, healing);
  for (const unit of units) {
    tickAfflictions(unit, tick, hit);
    if (unit.kind === "shieldbearer" && unit.hp > 0 && incomingShot(unit, battle.arrows)) unit.lastBraceTick = tick;
  }
  if (winds.length) arrows = arrows.filter(arrow => !blownAway(arrow, winds));
  const movedTargets = towers ? [...units, ...towers] : units;
  const wards = spells?.filter(s => s.kind === "mirror" && tick-s.startTick >= SPELLS.mirror.delay) ?? [];
  const incoming = winds.length ? battle.arrows.filter(arrow => !blownAway(arrow,winds)).map(a=>deflectHead(a,winds)) : battle.arrows;
  if (winds.length) arrows=arrows.map(a=>deflectHead(a,winds));
  const mills=incoming.length ? units.filter(u=>u.kind==="windmill" && u.hp>0 && disabledUntil(u)<=tick) : [];
  let fanContacts: Map<Arrow,FanContact> | undefined;
  if (mills.length) {
    fanContacts=new Map();
    for (const arrow of incoming) {
      const contact=firstFanContact(arrow,mills);
      if (contact) fanContacts.set(arrow,contact);
    }
  }
  const reflected = reflectAtWards(incoming,wards,targets,movedTargets,tick,fanContacts);
  for (const arrow of incoming) {
    const returned = reflected.get(arrow);
    if (returned) { arrows.push(returned); continue; }
    if (!arrow.kind || arrow.kind === "dart") noticeFriendlyArrow(arrow, units, tick);
    const flying = advanceShot(arrow, tick, targets, movedTargets, byId, hit, effects, conversions, fanContacts?.get(arrow));
    if (flying) arrows.push(flying);
  }
  applyClouds(effects, units, winds, tick);
  for (const [index, unit] of units.entries()) {
    const from = starting[index];
    const distance = unit.kind==="sandworm" && from.tunnel ? 0 : Math.hypot(unit.x - from.x, unit.y - from.y);
    const speed = walkSpeed(unit) / TICKS_PER_SECOND;
    // A shove can slide the ice. Keep the stride fixed inside the shell.
    if (unit.frozenUntil === undefined) {
      unit.walkDistance += distance;
      unit.pace += ((speed ? Math.min(1, distance / speed) : 0) - unit.pace) * .3;
    }
    if ((unit.kind === "lancer" || unit.kind==="rhinorider") && unit.lastChargeTick !== tick) {
      const straight = unit.aimX * from.aimX + unit.aimY * from.aimY > 0.93;
      unit.runUp = distance > 0.15 && straight && !from.knockback && !unit.knockback && unit.rootedUntil===undefined && !control.shocks.has(unit.id) && tick >= disabledUntil(unit) ? Math.min(60, (from.runUp ?? 0) + Math.min(distance, speed)) : 0;
      const threshold=UNIT_DEFINITIONS[unit.kind].runUp;
      if ((from.runUp ?? 0) < threshold && unit.runUp >= threshold) unit.lastChargeReadyTick=tick;
    }
    const amount = damage.get(unit.id);
    if (amount === undefined) continue;
    unit.hp = Math.max(0, unit.hp - amount);
    unit.lastHitTick = tick;
    if (!unit.hp && unit.kind === "phoenix" && !unit.reborn) {
      unit.hp = 1; unit.reborn = true; unit.emberUntil = tick + UNIT_DEFINITIONS.phoenix.hatchTicks;
      unit.targetId = null; unit.pace = 0;
      delete unit.burn; delete unit.poison; delete unit.slowUntil; delete unit.knockback; delete unit.raging;
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
  collectSouls(cuts, byId, tick);
  if (fallen.size) {
    for (const unit of units) {
      if (unit.burn && fallen.has(unit.burn.team)) delete unit.burn;
      if (unit.poison && fallen.has(unit.poison.team)) delete unit.poison;
      if (unit.hp && fallen.has(unit.team)) { unit.hp = 0; unit.lastHitTick = tick; }
    }
  }
  finishTreatments(units, byId, tick, healing);
  resolveConversions(conversions, byId, tick, fallen);
  const births=settleTroopBodies(units,byId,damage,fallen,tick);
  const recruits: Placement[] = [];
  for (const unit of units) {
    const child = finishBuilding(unit, tick);
    if (child) recruits.push(child);
  }
  if (recruits.length) units.push(...createBattle(recruits).units);
  if (births.length) {
    const newborns=createBattle(births.map(b=>b.placement),tick).units;
    births.forEach((birth,i)=>{ if (birth.slime) Object.assign(newborns[i],birth.slime,{smallSlime:true}); });
    units.push(...newborns);
  }
  const remaining = fallen.size ? spells?.filter(s => !fallen.has(s.team)) : spells;
  const portals = remaining?.filter(s => s.kind==="wormhole");
  if (portals?.length) transportEnemies(portals,starting,units,tick);
  starting.forEach((from,i) => {
    const unit=units[i];
    if (unit.warpedTick!==tick) recordTrail(unit,from,tick);
    if (unit.kind==="sandworm" && unit.hp>0) followWormHead(unit,from,tick);
  });
  return new Battle(tick, units, fallen.size ? arrows.filter(a => !fallen.has(a.team)) : arrows, bases,
    portals?.length ? remaining?.filter(s => s.kind!=="wormhole" || tick<s.startTick+SPELLS.wormhole.duration) : remaining, effects,
    floorAfterCast(battle.marks,battle.spells,tick));
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
