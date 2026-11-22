import type { Team, Target } from "./simulation.ts";
import { BASE_RADIUS } from "./battlefield.ts";
import { footprint } from "./units.ts";

export interface Arrow {
  // "balloon" is the Clown's glass bottle in saved and live snapshots.
  kind?: "bolt" | "dart" | "bullet" | "bomb" | "ice" | "venom" | "balloon" | "hex" | "stone" | "head" | "snowball" | "harpoon";
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
  windTurn?: {tick: number; fraction: number; vx: number; vy: number};
}

export function arrowPose(shot: Arrow, snapshotTick: number, tick: number) {
  const turn=shot.windTurn;
  if (turn && tick<turn.tick) {
    // Rewind to the actual contact before following the incoming shaft back along its original line.
    const x=shot.x-(snapshotTick-turn.tick)*shot.vx, y=shot.y-(snapshotTick-turn.tick)*shot.vy;
    const before=tick-(turn.tick-1+turn.fraction);
    if (before<0) return {x:x+turn.vx*before,y:y+turn.vy*before,vx:turn.vx,vy:turn.vy};
    return {x,y,vx:shot.vx,vy:shot.vy};
  }
  const rewind=snapshotTick-tick;
  return {x:shot.x-shot.vx*rewind,y:shot.y-shot.vy*rewind,vx:shot.vx,vy:shot.vy};
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
    const end = next[i], radius = target.kind === "base" ? BASE_RADIUS : footprint(target);
    const time = circleEntry(shot.x-target.x,shot.y-target.y,shot.vx-(end.x-target.x),shot.vy-(end.y-target.y),radius);
    if (time !== undefined) hits.push({target, time});
  }
  return hits.sort((a, b) => a.time - b.time || a.target.id - b.target.id);
}

export function firstArrowImpact(shot: Arrow, previous: readonly Target[], next: readonly Target[]) {
  return projectileContacts(shot, previous, next)[0]?.target;
}
