import { ARENA, ARMIES, TEAMS, type Team } from "./battlefield.ts";
import type { Target, Unit } from "./simulation.ts";
import { nearestEnemy } from "./targeting.ts";
import { isHuman, isMachine, UNIT_DEFINITIONS, type RecruitKind } from "./units.ts";

export interface Hex { kind: RecruitKind; team: Team; since: number; until: number; nextAttackTick: number }
export interface Conversion { id: number; team: Team; casterId: number; kind: "bite" | "hex" }
export interface Harvest { casterId: number; victimId: number }

export function maxHealth(unit: Unit) { return UNIT_DEFINITIONS[unit.hex?.kind ?? unit.kind].maxHp; }
export function bountyFor(unit: Unit) {
  if (unit.hex && unit.killedBy === unit.hex.team) return 0;
  return UNIT_DEFINITIONS[unit.hex?.kind ?? unit.kind].bounty;
}
export function canHex(target: Target) {
  return target.kind !== "base" && target.kind !== "pig" && !isMachine(target.kind) && !target.emberUntil && !target.tunnel;
}
export function hasSoul(target: Target): target is Unit {
  return target.kind !== "base" && !isMachine(target.kind) && target.kind !== "zombie" && target.kind !== "reaper" && !target.emberUntil && !target.tunnel;
}
export function hunt(reaper: Unit, targets: readonly Target[]) {
  return nearestEnemy(reaper, targets.filter(t => hasSoul(t) && t.hp * 3 <= maxHealth(t)), UNIT_DEFINITIONS.reaper.huntRange);
}

function changeAllegiance(unit: Unit, team: Team, tick: number) {
  const r = UNIT_DEFINITIONS[unit.kind].radius;
  unit.x = Math.max(r, Math.min(ARENA.width-r,unit.x));
  unit.y = Math.max(r, Math.min(ARENA.height-r,unit.y));
  unit.team = team;
  unit.targetId = null;
  unit.aimX = ARMIES[team].facing; unit.aimY = 0;
  unit.pace = 0; unit.lastAttackTick = null; unit.attackDirection = null;
  unit.nextAttackTick = tick + 5;
  delete unit.windup; delete unit.runUp; delete unit.wrappingSince; delete unit.constructingSince;
  delete unit.burstLeft; delete unit.nextBurstTick; delete unit.trail;
  if (unit.poison?.team === team) delete unit.poison;
  if (unit.burn?.team === team) delete unit.burn;
}

export function releaseHex(unit: Unit, tick: number) {
  const hex = unit.hex;
  if (!hex) return;
  unit.kind = hex.kind;
  changeAllegiance(unit, hex.team, tick);
  unit.nextAttackTick = Math.max(tick + 1, hex.nextAttackTick);
  unit.unhexedTick = tick;
  delete unit.hex;
}

// Damage, swallowing and base losses settle before a living target changes sides.
// Contested bites take precedence over a hex. Seat order and caster ID break ties.
export function resolveConversions(events: Conversion[], byId: ReadonlyMap<number, Unit>, tick: number, fallen: ReadonlySet<Team>) {
  events.sort((a,b) => Number(a.kind === "hex") - Number(b.kind === "hex") || TEAMS.indexOf(a.team)-TEAMS.indexOf(b.team) || a.casterId-b.casterId);
  const changed = new Set<number>();
  for (const event of events) {
    const unit = byId.get(event.id);
    if (!unit || !unit.hp || changed.has(unit.id) || unit.team === event.team || fallen.has(event.team) || fallen.has(unit.team)) continue;
    if (event.kind === "bite") {
      if (!isHuman(unit.kind)) continue;
      unit.zombified = {kind: unit.kind, team: unit.team, tick};
      unit.kind = "zombie";
      unit.hp = Math.min(unit.hp, UNIT_DEFINITIONS.zombie.maxHp);
      delete unit.poison;
      changeAllegiance(unit,event.team,tick);
      unit.nextAttackTick = tick + UNIT_DEFINITIONS.zombie.turnTicks;
    } else {
      if (unit.kind === "pig" || !canHex(unit)) continue;
      unit.hex = {kind: unit.kind, team: unit.team, since: tick, until: tick + UNIT_DEFINITIONS.witch.hexTicks, nextAttackTick: unit.nextAttackTick};
      unit.kind = "pig";
      changeAllegiance(unit,event.team,tick);
    }
    changed.add(unit.id);
  }
}

export function collectSouls(cuts: Harvest[], byId: ReadonlyMap<number, Unit>, tick: number) {
  const claimed = new Set<number>();
  for (const cut of cuts.sort((a,b)=>a.casterId-b.casterId)) {
    const reaper = byId.get(cut.casterId), victim = byId.get(cut.victimId);
    if (!reaper || reaper.kind !== "reaper" || !reaper.hp || !victim || victim.hp || victim.swallowedTick === tick ||
        victim.lastHitTick !== tick || claimed.has(victim.id)) continue;
    reaper.hp = Math.min(maxHealth(reaper), reaper.hp + UNIT_DEFINITIONS.reaper.harvestHp);
    reaper.soul = {x: victim.x, y: victim.y, tick};
    claimed.add(victim.id);
  }
}
