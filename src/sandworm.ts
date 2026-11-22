import { ARENA } from "./battlefield.ts";
import type { Unit } from "./simulation.ts";

const links=9, spacing=9;
type Point={x:number;y:number};
const inside=(v: number,extent: number)=>Math.round(Math.max(5,Math.min(extent-5,v))*10)/10;

// A fresh worm lays its tail behind its head, curling into the arena at an edge.
export function initialWormBody(unit: Pick<Unit,"id"|"x"|"y"|"aimX"|"aimY">): Point[] {
  const back=Math.atan2(-unit.aimY,-unit.aimX);
  const side=unit.y<ARENA.height/2 ? 1 : -1;
  let heading=back;
  for (const turn of [0,1,-1,2,-2,3,-3,4]) {
    heading=back+turn*side*Math.PI/4;
    const x=unit.x+links*spacing*Math.cos(heading),y=unit.y+links*spacing*Math.sin(heading);
    if (x>=6 && x<=ARENA.width-6 && y>=6 && y<=ARENA.height-6) break;
  }
  const joints: Point[]=[];
  let {x,y}=unit;
  for (let i=0;i<links;i++) {
    const a=heading+.42*Math.sin(i*.78+unit.id);
    x=inside(x+spacing*Math.cos(a),ARENA.width); y=inside(y+spacing*Math.sin(a),ARENA.height);
    joints.push({x,y});
  }
  return joints;
}

// Follow each preceding joint from its last position, so turns reach the tail later.
export function followWormHead(unit: Unit, previous: Unit, tick: number) {
  if (unit.warpedTick===tick) { unit.wormBody=initialWormBody(unit); return; }
  const old=previous.wormBody ?? initialWormBody(previous);
  if (unit.x===previous.x && unit.y===previous.y) { unit.wormBody=old; return; }
  const joints: Point[]=[];
  let front: Point=unit, backX=-unit.aimX, backY=-unit.aimY;
  for (const joint of old) {
    const dx=joint.x-front.x,dy=joint.y-front.y,distance=Math.hypot(dx,dy);
    if (distance>.01) {backX=dx/distance; backY=dy/distance;}
    front={x:inside(front.x+spacing*backX,ARENA.width),y:inside(front.y+spacing*backY,ARENA.height)};
    joints.push(front);
  }
  unit.wormBody=joints;
}
