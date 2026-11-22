import { ARENA, ARMIES, type Base } from "./battlefield.ts";
import type { Unit } from "./simulation.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

export interface Tunnel { fromX: number; fromY: number; toX: number; toY: number; start: number; end: number; bend?: {x:number; y:number} }
const miner = UNIT_DEFINITIONS.miner;
const worm = UNIT_DEFINITIONS.sandworm;

export function diveWorm(unit: Unit, tick: number, tickRate: number) {
  const aim=unit.windup!;
  const bound=(v: number,span: number)=>Math.max(worm.radius,Math.min(span-worm.radius,v));
  const toX=bound(aim.x,ARENA.width),toY=bound(aim.y,ARENA.height);
  const dx=toX-unit.x,dy=toY-unit.y,distance=Math.hypot(dx,dy);
  const side=unit.id%2 ? 1 : -1;
  const arc=(20+Math.min(20,distance*.2))*side;
  const bend={x:bound((toX+unit.x)/2-(distance ? dy/distance : unit.aimY)*arc,ARENA.width),
    y:bound((toY+unit.y)/2+(distance ? dx/distance : unit.aimX)*arc,ARENA.height)};
  const length=Math.hypot(bend.x-unit.x,bend.y-unit.y)+Math.hypot(toX-bend.x,toY-bend.y);
  unit.tunnel={fromX:unit.x,fromY:unit.y,toX,toY,bend,start:tick,end:tick+Math.max(worm.minTunnelTicks,Math.ceil(length*tickRate/worm.tunnelSpeed))};
  unit.targetId=null;
  delete unit.knockback; delete unit.windup;
}

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
  if (tunnel.bend) {
    const curl=2*fraction*(1-fraction);
    unit.x += curl*(tunnel.bend.x-(tunnel.fromX+tunnel.toX)/2);
    unit.y += curl*(tunnel.bend.y-(tunnel.fromY+tunnel.toY)/2);
  }
  if (tick < tunnel.end) return;
  unit.emergedTick = tick;
  unit.nextAttackTick = tick + (unit.kind==="sandworm" ? worm.cooldownTicks : miner.emergeTicks);
  delete unit.tunnel;
}
