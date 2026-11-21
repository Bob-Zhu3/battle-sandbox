import type { Team, Target } from "./simulation.ts";
import { BASE_RADIUS } from "./battlefield.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

export interface Arrow {
  // "balloon" is the Clown's glass bottle in saved and live snapshots.
  kind?: "bolt" | "dart" | "bullet" | "bomb" | "ice" | "venom" | "balloon" | "hex" | "stone";
  casterId?: number;
  piercedIds?: number[];
  landTick?: number;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  releasedTick: number;
  reflectedTick?: number;
}

// Intersect the moving tip with a moving circle over one tick. In the circle's
// frame of reference the circle stands still and the tip follows one segment.
export function circleEntry(x: number, y: number, dx: number, dy: number, radius: number): number | undefined {
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;

  const a = dx * dx + dy * dy;
  const b = x * dx + y * dy;
  if (a === 0 || b >= 0) return;
  // Solve |(x,y) + t*(dx,dy)|² = radius² for the first point of contact.
  const discriminant = b * b - a * c;
  if (discriminant < 0) return;
  const t = c / (-b + Math.sqrt(discriminant));
  if (t <= 1) return t;
}

export function projectileContacts(shot: Arrow, previous: readonly Target[], next: readonly Target[]) {
  const hits: {target: Target; time: number}[] = [];
  for (const [i, target] of previous.entries()) {
    if (target.id === shot.casterId || target.hp <= 0 || (target.kind !== "base" && target.tunnel) || target.team === shot.team || shot.piercedIds?.includes(target.id) ||
        (shot.kind === "bolt" && target.kind === "base" && shot.reflectedTick === undefined)) continue;
    const end = next[i], radius = target.kind === "base" ? BASE_RADIUS : UNIT_DEFINITIONS[target.kind].radius;
    const time = circleEntry(shot.x-target.x,shot.y-target.y,shot.vx-(end.x-target.x),shot.vy-(end.y-target.y),radius);
    if (time !== undefined) hits.push({target, time});
  }
  return hits.sort((a, b) => a.time - b.time || a.target.id - b.target.id);
}

export function firstArrowImpact(shot: Arrow, previous: readonly Target[], next: readonly Target[]) {
  return projectileContacts(shot, previous, next)[0]?.target;
}
