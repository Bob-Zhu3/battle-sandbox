import type { Target } from "./simulation.ts";

export function exposed(target: Target) {
  return target.hp > 0 && (target.kind === "base" || !target.tunnel);
}

export function nearestEnemy<T extends Target>(seeker: Pick<Target, "team" | "x" | "y">, candidates: readonly T[], range = Infinity): T | undefined {
  let closest: T | undefined;
  let best = range * range;
  for (const candidate of candidates) {
    if (candidate.team === seeker.team || !exposed(candidate)) continue;
    const distance = (candidate.x - seeker.x) ** 2 + (candidate.y - seeker.y) ** 2;
    if (distance < best || (distance === best && (!closest || candidate.id < closest.id))) {
      closest = candidate;
      best = distance;
    }
  }
  return closest;
}
