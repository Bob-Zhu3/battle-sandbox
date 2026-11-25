import type { Unit } from "./simulation.ts";
import { rhinoCharging } from "./units.ts";

export interface TrailMark { x: number; y: number; tick: number; side: number }
export type TrailKind = "frost" | "fire" | "spark" | "track" | "wisp" | "charm" | "shuffle" | "dust";
export const TRAILS = {
  frostqueen: {kind: "frost", spacing: 9}, phoenix: {kind: "fire", spacing: 7},
  kirin: {kind: "spark", spacing: 10}, cyclops: {kind: "track", spacing: 11},
  reaper: {kind: "wisp", spacing: 9}, witch: {kind: "charm", spacing: 10}, zombie: {kind: "shuffle", spacing: 10},
  rhinorider: {kind: "dust", spacing: 14},
} as const;
export const TRAIL_TICKS = 42;

// These few world-space samples describe the actual path, including turns.
// Renderers can age them directly from a paused, replayed or rejoined tick.
export function recordTrail(unit: Unit, from: Unit, tick: number) {
  if (unit.trail?.length && tick - unit.trail[0].tick >= TRAIL_TICKS) {
    unit.trail = unit.trail.filter(mark => tick-mark.tick < TRAIL_TICKS);
    if (!unit.trail.length) delete unit.trail;
  }
  if (!(unit.kind in TRAILS) || !unit.hp || unit.emberUntil || unit.tunnel || from.kind !== unit.kind) return;
  const spec = TRAILS[unit.kind as keyof typeof TRAILS];
  if (spec.kind === "dust" && !rhinoCharging(unit)) return;
  if (Math.hypot(unit.x-from.x,unit.y-from.y) < .2) return;
  const last = unit.trail?.at(-1);
  if (last && Math.hypot(from.x-last.x, from.y-last.y) < spec.spacing) return;
  const side = last ? -last.side : unit.id % 2 ? -1 : 1;
  unit.trail = [...(unit.trail ?? []).slice(-5), {x:from.x,y:from.y,tick,side}];
}
