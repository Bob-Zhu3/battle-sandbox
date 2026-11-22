import { ARMIES, type Base, type Team } from "./battlefield.ts";
import { line, oval, type Dye, type Pens } from "./ink.ts";
import { prismLevel } from "./siege.ts";
import type { Target, Unit } from "./simulation.ts";
import { exposed } from "./targeting.ts";
import { TOWER_ART_SCALE, unitArtScale } from "./tower-art.ts";
import { footprint, UNIT_DEFINITIONS } from "./units.ts";

type Point = {x:number; y:number};
type Body = Point & {unit:Unit; from:Unit};

export function crystalFocus(age: number) {
  const rule=UNIT_DEFINITIONS.prism;
  return Math.min(1, Math.max(0, age / ((rule.maxLevel-1) * rule.focusTicks)));
}

export function crystalLift(tick: number, id: number, focus: number) {
  return .5 * Math.sin((tick + id * 13) * .063) * (1 - focus) + 1.65 * focus;
}

// In beam coordinates the main target is straight ahead. The two colored
// strands change direction at the facets before meeting the central ray.
function refracted(c: Pens, length: number, offset: number, color: string) {
  c.beginPath(); c.moveTo(0, offset * .29);
  c.lineTo(length * .23, offset); c.lineTo(length * .67, offset * .83);
  c.lineTo(length, offset * .12);
  c.strokeStyle = color; c.lineWidth = 1.38; c.stroke();
}

function secondary(c: Pens, a: Point, b: Point, k: number, color: string, age: number) {
  const dx = b.x-a.x, dy = b.y-a.y;
  line(c,a.x,a.y,b.x,b.y,color,1.35*k);
  const phase = ((age % 41) + 1) / 42;
  const t = Math.min(1,phase+.065);
  line(c,a.x+dx*phase,a.y+dy*phase,a.x+dx*t,a.y+dy*t,"#ffebc8",1.15*k);
  oval(c,b.x,b.y,2.0*k,2.0*k,color);
  oval(c,b.x,b.y,.9*k,.9*k,"#fff3cb");
}

function primary(c: Pens, a: Point, b: Point, k: number, dye: Dye, age: number, id: number) {
  const dx=b.x-a.x, dy=b.y-a.y, length=Math.hypot(dx,dy)/k;
  if (length < .2) return;
  const focus=crystalFocus(age), level=prismLevel(age);
  const phase=(age+id*7)*.12;
  const spread=Math.min(length*.085,6.8) * (1-focus);
  const width=1.05+3.4*focus;
  c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx));c.scale(k,k);
  c.lineCap="round";c.lineJoin="round";
  if (focus>.55) {
    c.save();c.globalAlpha*=.34*(focus-.55);
    line(c,0,0,length,0,dye.coat,width+5.2);
    c.restore();
  }
  if (spread > .45) {
    const drift=.40*Math.sin(phase)*(1-focus);
    refracted(c,length,-spread+drift,"#ad638b");
    refracted(c,length,spread+drift,"#4399a4");
  }
  line(c,0,0,length,0,dye.hem,width+1.1);
  line(c,0,0,length,0,level<3 ? "#efbb67" : dye.light,width);
  if (focus>.04) line(c,0,0,length,0,"#fff6c9",.47+2.25*focus);
  // A single highlight runs along the glass. Its direction stays clear in a still crowd.
  const start=length*((age+id*3)%28)/28;
  line(c,start,0,Math.min(length,start+6+6*focus),0,"#fffdeb",.85+focus);
  const spark=1.85+2.25*focus+.33*Math.sin(phase);
  c.translate(length,0);
  c.beginPath();c.moveTo(spark*1.2,0);c.lineTo(spark*.29,spark*.29);
  c.lineTo(0,spark);c.lineTo(-spark*.32,spark*.27);c.lineTo(-spark*1.25,0);
  c.lineTo(-spark*.31,-spark*.27);c.lineTo(0,-spark);c.lineTo(spark*.28,-spark*.29);c.closePath();
  c.fillStyle="#fff4c3";c.fill();c.strokeStyle=dye.hem;c.lineWidth=.68;c.stroke();
  c.restore();
}

// The positions in bodies have already been interpolated for this displayed
// tick, including teleports. An ID lookup keeps the endpoint on that same body.
export function drawPrismLocks(c: Pens, bodies: readonly Body[], bases: readonly Base[] | undefined,
    tick: number, snapshotTick: number, sx: number, sy: number) {
  const k=Math.min(sx,sy);
  let positions: Map<number, Point & {unit:Target}> | undefined;
  function targetPoint(id: number, team: Team) {
    if (!positions) {
      positions=new Map(bodies.map(body=>[body.unit.id,body]));
      for (const base of bases ?? []) positions.set(base.id,{unit:base,x:base.x*sx,y:base.y*sy});
    }
    const drawn=positions.get(id);
    if (!drawn || drawn.unit.team===team || !exposed(drawn.unit)) return;
    const height=drawn.unit.kind==="base" ? 17 : Math.min(14,footprint(drawn.unit)*.59);
    return {x:drawn.x, y:drawn.y-height*k*unitArtScale(drawn.unit.kind)};
  }
  for (const {unit,from,x,y} of bodies) {
    if (unit.kind!=="prism" || !unit.hp) continue;
    const beforeChange=unit.focusSince!==undefined ? tick<unit.focusSince : tick<snapshotTick;
    const lock=beforeChange ? from : unit;
    if (lock.targetId===null || lock.focusSince===undefined || tick<lock.focusSince) continue;
    const end=targetPoint(lock.targetId,lock.team);
    if (!end) continue;
    const age=tick-lock.focusSince, focus=crystalFocus(age);
    const towerScale=k*TOWER_ART_SCALE;
    const origin={x, y:y-(11.2+crystalLift(tick,unit.id,focus))*UNIT_DEFINITIONS.prism.radius/11*towerScale};
    // A three-tick network update can already contain a later focus level.
    // Close the old side facet when the displayed clock reaches that level.
    const oldFacets=lock.focusSince===from.focusSince && prismLevel(age)<prismLevel(snapshotTick-lock.focusSince);
    const sides=oldFacets ? from.prismSides : lock.prismSides;
    if (sides?.length) {
      c.save(); c.lineCap="round";
      for (let i=0; i<sides.length; i++) {
        const side=targetPoint(sides[i],lock.team);
        if (!side || sides[i]===lock.targetId) continue;
        const facet={x:x+(i===0?-3:3)*towerScale, y:origin.y+1.1*towerScale};
        secondary(c,facet,side,k,i===0?"#ab709e":"#519fa8",age+i*11);
      }
      c.restore();
    }
    primary(c,origin,end,k,ARMIES[unit.team],age,unit.id);
  }
}
