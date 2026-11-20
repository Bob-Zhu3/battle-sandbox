import type { Unit, Target } from "./simulation.ts";
import { ARMIES, BASE_RADIUS } from "./battlefield.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
function smooth(value: number) {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
}
function since(tick: number, event: number | null) {
  return event === null ? Infinity : Math.max(0, tick - event);
}

export interface CharacterPose {
  breath: number;
  blink: number;
  side: number;
  pitch: number;
  step: number;
  lift: number;
  pace: number;
  guard: number;
  ready: number;
  strike: number;
  loose: number;
  peek: number;
  duck: number;
  hurt: number;
}

export function restingPose(side: number): CharacterPose {
  return { side, breath: 0, blink: 0, pitch: 0, step: 0, lift: 0, pace: 0, guard: 0, ready: 0, strike: 0, loose: 0, peek: 0, duck: 0, hurt: 0 };
}

export function characterPose(unit: Unit, target: Target | undefined, tick: number, travel = unit.walkDistance): CharacterPose {
  const pose = restingPose(ARMIES[unit.team].facing);
  if (!target && unit.hp > 0) {
    const phase = tick + unit.id * 53;
    pose.breath = Math.sin(phase / (unit.kind === "warrior" ? 17 : 14)) * .85;
    pose.blink = Math.max(0, 1 - Math.abs(phase % 163 - 3) / 3) * 1.05;
  }
  const kind: UnitKind = unit.kind;
  const definition = UNIT_DEFINITIONS[kind];
  const range = target ? Math.hypot(unit.x - target.x, unit.y - target.y) - (target.kind === "base" ? BASE_RADIUS : 0) : Infinity;
  const beat = travel / (kind === "warrior" ? 4.8 : 4.1) + unit.id * 2.39996;
  pose.pace = unit.pace;
  pose.step = unit.pace * Math.sin(beat);
  pose.lift = unit.pace * Math.abs(Math.cos(beat));
  const attackAge = since(tick, unit.lastAttackTick);
  const attentionAge = since(tick, unit.lastAttentionTick);
  const hitAge = since(tick, unit.lastHitTick);
  pose.hurt = (1 - smooth(hitAge / 10));
  // Raise the weapon on the last few strides into reach, or before the real
  // cooldown expires. Units placed in reach can still attack on tick one.
  const near = 1 - smooth((range - definition.reach) / (kind === "warrior" ? 42 : 30));
  const remaining = unit.nextAttackTick - tick;
  pose.ready = near * (1 - smooth((remaining - 1) / (kind === "warrior" ? 12 : 22)));
  if (kind === "warrior") {
    pose.guard = near;
    pose.strike = (1 - smooth((attackAge - 2) / 10));
    pose.duck = smooth((attentionAge + 1) / 4) * (1 - smooth((attentionAge - 8) / 11));
  } else {
    pose.loose = 1 - smooth((attackAge - 2) / 10);
    pose.peek = smooth((attentionAge - 2) / 7) * (1 - smooth((attentionAge - 18) / 11));
  }
  // Keep the blade on its swing and the Archer's eyes on the released shot,
  // even if another enemy becomes the closest during the follow-through.
  const follow = Math.max(pose.strike, pose.loose, pose.peek);
  const dx = unit.aimX + ((unit.attackDirection?.x ?? unit.aimX) - unit.aimX) * follow;
  const dy = unit.aimY + ((unit.attackDirection?.y ?? unit.aimY) - unit.aimY) * follow;
  if (Math.abs(dx) > .08) pose.side = Math.sign(dx);
  pose.pitch = Math.atan2(dy, Math.abs(dx));
  return pose;
}
