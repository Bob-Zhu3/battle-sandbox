import type { Team, Target } from "./simulation.ts";
import { BASE_RADIUS } from "./battlefield.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

export interface Arrow {
  team: Team;
  x: number;
  y: number;
  vx: number; // Arena units per tick. The direction is fixed at release.
  vy: number;
  damage: number;
  releasedTick: number;
}

// Intersect the moving tip with a moving circle over one tick. In the circle's
// frame of reference the circle stands still and the tip follows one segment.
function contactTime(arrow: Arrow, from: Target, to: Target): number | undefined {
  const x = arrow.x - from.x, y = arrow.y - from.y;
  const radius = from.kind === "base" ? BASE_RADIUS : UNIT_DEFINITIONS[from.kind].radius;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;

  const dx = arrow.vx - (to.x - from.x), dy = arrow.vy - (to.y - from.y);
  const a = dx * dx + dy * dy;
  const b = x * dx + y * dy;
  if (a === 0 || b >= 0) return;
  // Solve |(x,y) + t*(dx,dy)|² = radius² for the first point of contact.
  const discriminant = b * b - a * c;
  if (discriminant < 0) return;
  const t = c / (-b + Math.sqrt(discriminant));
  if (t <= 1) return t;
}

export function firstArrowImpact(arrow: Arrow, previous: readonly Target[], next: readonly Target[]): Target | undefined {
  let first: Target | undefined;
  let earliest = Infinity;
  for (const [index, unit] of previous.entries()) {
    if (unit.team === arrow.team || unit.hp <= 0) continue;
    const time = contactTime(arrow, unit, next[index]);
    if (time === undefined) continue;
    if (!first || time < earliest || (time === earliest && unit.id < first.id)) {
      first = unit;
      earliest = time;
    }
  }
  return first;
}
