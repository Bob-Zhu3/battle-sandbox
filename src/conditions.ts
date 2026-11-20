import { ARENA, TEAMS, type Team } from "./battlefield.ts";
import type { Target, Unit } from "./simulation.ts";
import { isBuilding, isMachine, UNIT_DEFINITIONS } from "./units.ts";

export interface Affliction { team: Team; until: number; next: number; applied: number }
export interface GroundEffect { kind: "blast" | "smash" | "frost" | "miasma"; team: Team; x: number; y: number; tick: number; radius: number }
export type Hit = (target: Target, amount: number, team: Team) => void;
export const effectLifetime = (e: GroundEffect) => e.kind === "miasma" ? UNIT_DEFINITIONS.clown.cloudTicks : 34;
const ailments = {
  burn: { period: 24, duration: 72, damage: 2 },
  poison: { period: 30, duration: 90, damage: 3 },
} as const;
type Ailment = keyof typeof ailments;

export function afflict(unit: Unit, kind: Ailment, team: Team, tick: number) {
  if (unit.hp <= 0 || unit.emberUntil !== undefined || (kind === "poison" && (isMachine(unit.kind) || unit.kind === "zombie"))) return;
  const prior = unit[kind], rule = ailments[kind];
  // Two simultaneous applications choose the same source in either storage order.
  const source = prior?.applied === tick && TEAMS.indexOf(prior.team) < TEAMS.indexOf(team) ? prior.team : team;
  unit[kind] = { team: source, until: tick + rule.duration, next: prior?.next ?? tick + rule.period, applied: tick };
}

export function tickAfflictions(unit: Unit, tick: number, hit: Hit) {
  for (const kind of ["burn", "poison"] as const) {
    const state = unit[kind], rule = ailments[kind];
    if (!state) continue;
    if (state.next === tick && tick <= state.until && unit.hp > 0) hit(unit, rule.damage, state.team);
    if (tick >= state.until || unit.hp <= 0) delete unit[kind];
    else if (state.next === tick) unit[kind] = { ...state, next: tick + rule.period };
  }
}

export function stun(unit: Unit, until: number) {
  unit.stunnedUntil = Math.max(until, unit.stunnedUntil ?? 0);
  if (unit.kind === "lancer") unit.runUp = 0;
  delete unit.windup;
  delete unit.wrappingSince;
  delete unit.constructingSince;
  delete unit.burstLeft;
  delete unit.nextBurstTick;
}

export function slow(unit: Unit, until: number) {
  if (!isBuilding(unit.kind)) unit.slowUntil = Math.max(until, unit.slowUntil ?? 0);
}

export function shove(unit: Unit, x: number, y: number, distance: number) {
  if (isBuilding(unit.kind) || unit.emberUntil !== undefined) return;
  const dx = unit.x - x, dy = unit.y - y, length = Math.hypot(dx, dy);
  const angle = unit.id * 2.4;
  const newX = (length ? dx / length : Math.cos(angle)) * distance;
  const newY = (length ? dy / length : Math.sin(angle)) * distance;
  unit.knockback = { x: newX + (unit.knockback?.x ?? 0), y: newY + (unit.knockback?.y ?? 0), ticks: 8 };
}

export function moveKnockback(unit: Unit) {
  const knock = unit.knockback;
  if (!knock) return;
  const portion = 2 / (knock.ticks + 1), r = UNIT_DEFINITIONS[unit.kind].radius;
  unit.x = Math.max(r, Math.min(ARENA.width - r, unit.x + knock.x * portion));
  unit.y = Math.max(r, Math.min(ARENA.height - r, unit.y + knock.y * portion));
  if (knock.ticks === 1) delete unit.knockback;
  else unit.knockback = { x: knock.x * (1 - portion), y: knock.y * (1 - portion), ticks: knock.ticks - 1 };
}
