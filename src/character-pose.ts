import type { Unit, Target } from "./simulation.ts";
import { ARMIES, BASE_RADIUS } from "./battlefield.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
function smooth(value: number) {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
}

export const HIT_FLASH_TICKS = 7;
export function eventFade(tick: number, event: number | null | undefined, duration: number) {
  if (event == null || tick < event) return 0;
  return 1 - smooth((tick - event) / duration);
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
  hitFlash: number;
}

export function restingPose(side: number): CharacterPose {
  return { side, breath: 0, blink: 0, pitch: 0, step: 0, lift: 0, pace: 0, guard: 0, ready: 0, strike: 0, loose: 0, peek: 0, duck: 0, hurt: 0, hitFlash: 0 };
}

export function characterPose(unit: Unit, target: Target | undefined, tick: number, travel = unit.walkDistance, previousHitTick = unit.lastHitTick, impactTick = tick): CharacterPose {
  const pose = restingPose(ARMIES[unit.team].facing);
  if (!target && unit.hp > 0) {
    const phase = tick + unit.id * 53;
    pose.breath = Math.sin(phase / (unit.kind === "warrior" ? 17 : 14)) * .85;
    pose.blink = Math.max(0, 1 - Math.abs(phase % 163 - 3) / 3) * 1.05;
  }
  const kind: UnitKind = unit.kind;
  const definition = UNIT_DEFINITIONS[kind];
  const range = target ? Math.hypot(unit.x - target.x, unit.y - target.y) - (target.kind === "base" ? BASE_RADIUS : 0) : Infinity;
  const beat = travel / (strideLength[kind] ?? 4.1) + unit.id * 2.39996;
  pose.pace = unit.pace;
  pose.step = unit.pace * Math.sin(beat);
  pose.lift = unit.pace * Math.abs(Math.cos(beat));
  const attackAge = since(tick, unit.lastAttackTick);
  const attentionAge = since(tick, unit.lastAttentionTick);
  // A second hit can already be in the next snapshot while we're drawing
  // the interval before it. Finish the previous flash up to the actual impact.
  const hit = unit.lastHitTick !== null && impactTick < unit.lastHitTick ? previousHitTick : unit.lastHitTick;
  const hitAge = hit !== null && impactTick >= hit ? impactTick - hit : Infinity;
  pose.hurt = (1 - smooth(hitAge / 10));
  // The first network snapshot after impact can arrive two simulation ticks later.
  pose.hitFlash = 1 - smooth((hitAge - 2) / (HIT_FLASH_TICKS - 2));
  // Raise the weapon on the last few strides into reach, or before the real
  // cooldown expires. Units placed in reach can still attack on tick one.
  const near = 1 - smooth((range - definition.reach) / (kind === "warrior" ? 42 : 30));
  const remaining = unit.nextAttackTick - tick;
  pose.ready = tick < (unit.stunnedUntil ?? 0) ? 0 : near * (1 - smooth((remaining - 1) / (kind === "warrior" ? 12 : 22)));
  if (kind==="archer" && unit.drawingBow && unit.lastDrawTick!==undefined) pose.ready=smooth((tick-unit.lastDrawTick+1)/13);
  if (kind === "warrior") {
    pose.guard = near;
    pose.strike = (1 - smooth((attackAge - 2) / 10));
    pose.duck = smooth((attentionAge + 1) / 4) * (1 - smooth((attentionAge - 8) / 11));
  } else if (kind === "archer" || kind === "musketeer" || kind === "drone") {
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

const strideLength: Partial<Record<UnitKind, number>> = {
  warrior: 4.8, lancer: 6.2, shieldbearer: 5.7, kirin: 6.9, cyclops: 11.5, zombie: 7.7,
};

// Shoulder and wrist reverse at different times. The long, nearly level
// interval after the downstroke is the glide. Height peaks after the stroke.
const wingbeat = [
  [0, .12, .45, 1.5], [.25, 1.02, -.48, 2.6], [.37, 1.13, .22, .5],
  [.56, -.86, -.08, 5.2], [.72, -.22, -.09, 6.2], [.88, -.12, -.12, 3.7], [1, .12, .45, 1.5],
] as const;

export function phoenixFlight(unit: Unit | undefined, pose: CharacterPose, tick: number) {
  const phase = (tick / 54 + (unit?.id ?? 0) * .381966) % 1;
  let i = 1;
  while (phase > wingbeat[i][0]) i++;
  const a = wingbeat[i - 1], b = wingbeat[i];
  const t = smooth((phase - a[0]) / (b[0] - a[0]));
  const talons = eventFade(tick, unit?.lastAttackTick, 11);
  const takeoff = eventFade(tick, unit?.lastHatchTick, 23);
  const age = tick - (unit?.lastAttackTick ?? -Infinity);
  const pullUp = age >= 0 && age < 23 ? Math.sin(Math.PI * age / 23) : 0;
  const aim = pose.ready;
  return {
    wing: (a[1] + (b[1] - a[1]) * t) * (1 - .75 * talons) + .78 * pullUp + .72 * takeoff,
    wrist: a[2] + (b[2] - a[2]) * t + .66 * talons,
    height: 5.4 + a[3] + (b[3] - a[3]) * t + 2.8 * aim - 7 * talons + 2.4 * pullUp - 4 * takeoff,
    pitch: .07 * pose.pace + .34 * talons - .16 * pullUp - .11 * aim,
    // The tip follows the root by about eleven ticks as the bird changes height.
    tail: Math.sin(2 * Math.PI * (phase - .12)),
    tailTip: Math.sin(2 * Math.PI * (phase - .32)),
    talons, pullUp, takeoff,
  };
}
