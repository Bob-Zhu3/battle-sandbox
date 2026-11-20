import type { Target } from "./simulation.ts";

export function nearestEnemy<T extends Target>(seeker: Pick<Target, "team" | "x" | "y">, candidates: readonly T[], range = Infinity): T | undefined {
  let closest: T | undefined;
  let best = range * range;
  for (const candidate of candidates) {
    if (candidate.team === seeker.team || candidate.hp <= 0) continue;
    const distance = (candidate.x - seeker.x) ** 2 + (candidate.y - seeker.y) ** 2;
    if (distance < best || (distance === best && (!closest || candidate.id < closest.id))) {
      closest = candidate;
      best = distance;
    }
  }
  return closest;
}
