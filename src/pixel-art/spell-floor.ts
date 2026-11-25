import type { Pens } from "../ink.ts";
import { MARK_TICKS, SPELLS, type SpellKind, type SpellMark } from "../spells.ts";
import { drawFloorFrame } from "./effect-player.ts";
import { segment } from "./stamps.ts";

type TileKind = Exclude<SpellKind,"fault">;
const tiles = new Map<string,HTMLCanvasElement>();
const ink: Record<TileKind,[string,string,string]> = {
  meteor:["#5b4650","#846461","#ab8a78"], lightning:["#58465f","#886b79","#b79b9d"],
  gust:["#908a74","#b8a786","#d5c9a3"], rain:["#6098a6","#94c4cb","#d5e8df"],
  briar:["#466b45","#719645","#a4bb65"], mirror:["#547d93","#83b6bb","#c4e1d9"],
  freeze:["#6eacc2","#9bd0d6","#d3e9e2"], rage:["#9d5364","#c97770","#e5a58a"],
  wormhole:["#765681","#a389ab","#c6b4bb"],
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
  } else if (kind==="lightning") {
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
  } else for (let i=0;i<12;i++) {
    const a=i*2.4+variant*.3, radius=Math.sqrt((i+.4)/12);
    const x=Math.round(39+Math.cos(a)*radius*32), y=Math.round(18+Math.sin(a)*radius*12);
    const flip=next()>.5 ? 1 : -1;
    if (kind==="rain") {
      p.fillStyle=mid; p.fillRect(x-4,y,7+Math.round(next()*4),2); p.fillStyle=light; p.fillRect(x-2,y-1,5,1);
      segment(p,x,y+2,x+4,y+2,dark);
    } else if (kind==="briar") {
      segment(p,x,y,x+4*flip,y-2,dark); p.fillStyle=mid; p.fillRect(x+flip,y-3,3,2);
      p.fillStyle=light; p.fillRect(x+flip+1,y-4,2,1);
    } else if (kind==="freeze") {
      segment(p,x-3,y+1,x+2,y-1,mid,2); segment(p,x+2,y-1,x+6,y-1,light);
      if (i%3===0) {segment(p,x,y,x-1,y-4,dark);segment(p,x-1,y-4,x-4,y-5,mid);}
    } else if (kind==="mirror") {
      segment(p,x-2,y+1,x+flip*2,y-2,dark,2); segment(p,x-1,y+1,x+flip*2,y-2,mid);
      p.fillStyle=light; p.fillRect(x,y-1,2,1);
    } else if (kind==="rage" || kind==="wormhole") {
      const b=i*Math.PI/6+variant*.35, reach=kind==="rage"?29:21;
      const point=(angle:number)=>[Math.round(39+Math.cos(angle)*reach),Math.round(18+Math.sin(angle)*reach*.39)];
      const [x1,y1]=point(b), [x2,y2]=point(b+.28);
      segment(p,x1,y1,x2,y2,i%3?mid:dark,kind==="wormhole"?3:2);
      if (i%2===0) segment(p,x2,y2,x2+flip*2,y2-2,light);
    } else {
      segment(p,x-3,y+1,x+1,y-1,mid); segment(p,x+1,y-1,x+5,y-1,light);
      if (i%4===0) {p.fillStyle=dark; p.fillRect(x+5,y-2,2,2);}
    }
  }
  tiles.set(key,tile);
  return tile;
}

export function drawSpellMark(c: Pens, m: SpellMark, tick: number, sx: number, sy: number) {
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
  } else if (m.kind==="lightning") {
    const boltScale=Math.max(k,Math.min(sy,.71));
    for (const [i,end] of (m.strikes?.length ? m.strikes : [m]).entries()) {
      const size=55*boltScale;
      c.save(); c.translate(end.x*sx,end.y*sy); c.scale((m.id+i)%2?1:-1,1);
      c.drawImage(floorTile("lightning",(m.id+i)%4),-size/2,-size*.225,size,size*.45);
      drawFloorFrame(c,"fulgurite",0,0,age,life,84*boltScale); c.restore();
    }
  } else {
    const tile=floorTile(m.kind,m.id%4);
    const size=m.kind==="wormhole" ? 1.9*radius*Math.max(k,Math.min(sy,.71)) : 1.62*radius*k;
    c.globalAlpha*=.86;
    c.drawImage(tile,x-size/2,y-size*.225,size,size*.45);
    if (m.kind==="wormhole" && m.entrance) c.drawImage(tile,m.entrance.x*sx-size/2,m.entrance.y*sy-size*.225,size,size*.45);
  }
  c.restore();
}
