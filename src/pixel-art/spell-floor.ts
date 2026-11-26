import type { Pens } from "../ink.ts";
import { leavesGroundMark, MARK_TICKS, SPELLS, type SpellMark } from "../spells.ts";
import { drawFloorFrame } from "./effect-player.ts";
import { segment } from "./stamps.ts";

type TileKind = Exclude<SpellMark["kind"],"fault">;
const tiles = new Map<string,HTMLCanvasElement>();
const ink: Record<TileKind,[string,string,string]> = {
  meteor:["#5b4650","#846461","#ab8a78"], lightning:["#58465f","#886b79","#b79b9d"],
};

function floorTile(kind: TileKind, variant: number) {
  const key=kind+variant;
  const cached=tiles.get(key);
  if (cached) return cached;
  const tile=document.createElement("canvas"); tile.width=80; tile.height=36;
  const p=tile.getContext("2d")!, [dark,mid,light]=ink[kind];
  // Small clusters and broken edges retain white ground between distinct scars.
  let seed=181+variant*243;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
  if (kind==="meteor") {
    // Broken lip, a cooler sunk centre and a few displaced fragments.
    for (const [x,y,w,h,color] of [
      [22,14,32,2,mid],[15,16,48,2,mid],[12,18,55,3,dark],[17,21,46,3,mid],
      [22,24,32,2,light],[22,17,27,3,dark],[15,22,9,2,light],[50,16,10,2,light],
    ] as const) {p.fillStyle=color;p.fillRect(x,y,w,h);}
    for (let i=0;i<12;i++) {
      const a=next()*Math.PI*2;
      p.fillStyle=i%3===0?mid:light;
      p.fillRect(Math.round(40+Math.cos(a)*(27+next()*8)),Math.round(20+Math.sin(a)*(5+next()*5)),2+i%3,1+i%2);
    }
  } else {
    for (let i=0;i<6;i++) {
      const a=i*Math.PI/3+variant*.20, dx=Math.cos(a),dy=Math.sin(a)*.57;
      let x=40,y=19;
      for (let j=0;j<4;j++) {
        const nx=x+dx*(5+next()*3), ny=y+dy*(4+next()*4)+(next()-.5)*3;
        segment(p,x,y,nx,ny,j>2 ? mid : dark,j===0?2:1);
        if (j===1) segment(p,nx,ny,nx-dy*7+dx*4,ny+dx*3,light);
        x=nx; y=ny;
      }
    }
  }
  tiles.set(key,tile);
  return tile;
}

export function drawSpellMark(c: Pens, m: SpellMark, tick: number, sx: number, sy: number) {
  if (!leavesGroundMark(m.kind)) return; // An older multiplayer snapshot can still contain these.
  const age=tick-m.startTick-SPELLS[m.kind].duration, life=MARK_TICKS[m.kind];
  if (age<0 || age>=life) return;
  const k=Math.min(sx,sy), radius=SPELLS[m.kind].radius;
  const x=m.x*sx,y=m.y*sy;
  c.save(); c.globalAlpha*=Math.min(1,(life-age)/(life*.46)); c.imageSmoothingEnabled=false;
  if (m.kind==="fault") {
    c.translate(x,y); c.scale(1,1.5);
    drawFloorFrame(c,"faultFloor",0,0,age,life,2*radius*k);
  } else if (m.kind==="meteor") {
    const size=radius*1.15*k;
    c.drawImage(floorTile("meteor",m.id%4),x-size/2,y-size*.225,size,size*.45);
    drawFloorFrame(c,"crater",x,y,age,life,2*radius*k);
  } else {
    const boltScale=Math.max(k,Math.min(sy,.71));
    for (const [i,end] of (m.strikes?.length ? m.strikes : [m]).entries()) {
      const size=55*boltScale;
      c.save(); c.translate(end.x*sx,end.y*sy); c.scale((m.id+i)%2?1:-1,1);
      c.drawImage(floorTile("lightning",(m.id+i)%4),-size/2,-size*.225,size,size*.45);
      drawFloorFrame(c,"fulgurite",0,0,age,life,84*boltScale); c.restore();
    }
  }
  c.restore();
}
