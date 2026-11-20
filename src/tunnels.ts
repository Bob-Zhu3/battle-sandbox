import { ARENA, ARMIES, type Base } from "./battlefield.ts";
import type { Unit } from "./simulation.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

export interface Tunnel { fromX: number; fromY: number; toX: number; toY: number; start: number; end: number }
const miner = UNIT_DEFINITIONS.miner;

export function digFromHome(unit: Unit, tick: number, ticksPerSecond: number, base?: Base) {
  const toX = unit.x, toY = unit.y;
  unit.x = base?.x ?? (ARMIES[unit.team].facing > 0 ? 34 : ARENA.width-34);
  unit.y = base?.y ?? toY;
  const travel = Math.ceil(Math.hypot(toX-unit.x, toY-unit.y) * ticksPerSecond / miner.tunnelSpeed);
  const start = tick + miner.digTicks;
  unit.tunnel = {fromX: unit.x, fromY: unit.y, toX, toY, start, end: start + Math.max(1,travel)};
}

export function advanceTunnel(unit: Unit, tick: number) {
  const tunnel = unit.tunnel!;
  const fraction = Math.max(0, Math.min(1, (tick-tunnel.start)/(tunnel.end-tunnel.start)));
  unit.x = tunnel.fromX + (tunnel.toX-tunnel.fromX)*fraction;
  unit.y = tunnel.fromY + (tunnel.toY-tunnel.fromY)*fraction;
  if (tick < tunnel.end) return;
  unit.emergedTick = tick;
  unit.nextAttackTick = tick + miner.emergeTicks;
  delete unit.tunnel;
}
