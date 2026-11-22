import { ARMIES, BASE_RADIUS, type Base } from "./battlefield.ts";
import { INK, type Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { TOWER_ART_SCALE } from "./tower-art.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

type Point = {x: number; y: number};
type Body = Point & {unit: Unit; from: Unit; radius: number};
type Section = Point & {radius: number};
type Tip = {x: number; y: number; side: number; scale: number; far: boolean; sections: Section[]};
type Grips = Map<number, Tip[]>;

export const KRAKEN_SKIN = {mantle: "#a36c89", shadow: "#7d5a77", sucker: "#ebbc9e"};

// Displacement occupies the eight ticks after contact. The free arm then
// folds back into the short coil on the Kraken's body.
export function tentacleExtension(age: number) {
  if (age < 0 || age >= 21) return 0;
  const back = Math.max(0, (age - 8) / 13);
  return 1 - back * back * (3 - 2 * back);
}

function curve(spine: Section[], ax: number, ay: number, bx: number, by: number,
    x: number, y: number, radius: number, steps: number) {
  const start = spine[spine.length - 1];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, v = 1 - t;
    spine.push({
      x: v*v*v*start.x + 3*v*v*t*ax + 3*v*t*t*bx + t*t*t*x,
      y: v*v*v*start.y + 3*v*v*t*ay + 3*v*t*t*by + t*t*t*y,
      radius: start.radius + (radius - start.radius) * t,
    });
  }
}

// The outside edge and the row of suckers follow the same bending spine.
// Omitting the root's closing ink stroke leaves a smooth joint at the wrist.
const normalX: number[] = [], normalY: number[] = [];
function paintArm(c: Pens, spine: readonly Section[], far: boolean, cuff: boolean) {
  c.beginPath();
  for (let i = 0; i < spine.length; i++) {
    const p = spine[i], before = spine[Math.max(0, i - 1)], after = spine[Math.min(i + 1, spine.length - 1)];
    const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1;
    normalX[i] = -dy * p.radius / length; normalY[i] = dx * p.radius / length;
    if (i) c.lineTo(p.x+normalX[i],p.y+normalY[i]);
    else c.moveTo(p.x+normalX[i],p.y+normalY[i]);
  }
  for (let i = spine.length - 1; i >= 0; i--) c.lineTo(spine[i].x-normalX[i],spine[i].y-normalY[i]);
  c.fillStyle = cuff ? "#b17b91" : far ? "#906780" : KRAKEN_SKIN.mantle; c.fill();
  c.strokeStyle = INK; c.lineWidth = cuff ? 1.15 : 1.45; c.stroke();
  let travelled = 0, nextCup = cuff ? 3.2 : 9;
  for (let i = 1; i < spine.length-1; i++) {
    const p = spine[i], before = spine[i-1];
    travelled += Math.hypot(p.x-before.x,p.y-before.y);
    if (travelled < nextCup || p.radius < 1.25) continue;
    const r = Math.min(1.8, .48*p.radius), x = p.x+normalX[i]*.36, y = p.y+normalY[i]*.36;
    const angle = Math.atan2(-normalX[i],normalY[i]);
    nextCup = travelled + (cuff ? 5 : 8+p.radius*.9);
    c.beginPath(); c.ellipse(x,y,r*1.24,r*.76,angle,0,2*Math.PI);
    c.fillStyle = KRAKEN_SKIN.sucker; c.fill();
    if (r < 1.05) continue;
    c.beginPath(); c.ellipse(x,y,r*.50,r*.32,angle,0,2*Math.PI);
    c.fillStyle = "#a77174"; c.fill();
  }
}

export function drawKrakenTips(c: Pens, tips: readonly Tip[] | undefined) {
  if (!tips) return;
  for (const tip of tips) {
    c.save(); c.translate(tip.x,tip.y); c.scale(tip.scale*tip.side,tip.scale);
    c.lineJoin = c.lineCap = "round"; paintArm(c,tip.sections,tip.far,true); c.restore();
  }
}

function drawArm(c: Pens, body: Body, target: Point, radius: number, side: number, scale: number,
    age: number, far: boolean, keep: boolean, bendSide: number) {
  const reach = tentacleExtension(age), fold = 1 - reach;
  const x = body.x + side * body.radius * (far ? .15 : .29);
  const y = body.y + body.radius * (far ? -.10 : .06);
  const endX = (target.x - x) * side / scale, endY = (target.y - y) / scale;
  // The end loops horizontally around the torso regardless of the approach
  // angle. Arena positions and unstretched body radii use their own scales.
  const cx = endX * reach + (far ? 5 : 8) * fold;
  const cy = endY * reach + (far ? -2 : 3) * fold;
  const rx = radius * reach + 2 * fold, ry = Math.max(2.4,rx * .36);
  const entryX = cx - rx, entryY = cy - .12 * ry;
  const length = Math.hypot(entryX,entryY);
  const bend = Math.min(27,length*.31) * bendSide *
    (.84 + .28 * Math.cos(Math.min(age, 8)*Math.PI/8) + .88 * Math.sin(fold*Math.PI));
  const nx = -entryY/(length || 1), ny = entryX/(length || 1);
  const spine = [{x: 0, y: 0, radius: (far ? 4.6 : 5.1) * (1 - .30 * fold)}];
  curve(spine, entryX*.27+nx*bend*1.15, entryY*.27+ny*bend*1.15,
    entryX*.72-nx*bend*.65, entryY*.72-ny*bend*.65, entryX, entryY, 2.8-.8*fold, 14);
  // Keeps are already painted behind the army. Hide the half of the coil
  // passing behind the wall while the other half closes across its face.
  if (!keep || fold > .05) {
    curve(spine,cx-rx*.55,cy-ry*1.35,cx+rx*1.10,cy-ry*1.32,cx+rx,cy,2.12-.55*fold,9);
  }
  c.save(); c.translate(x,y); c.scale(side*scale,scale); c.lineCap = c.lineJoin = "round";
  paintArm(c,spine,far,false); c.restore();
  const opening = Math.sin(Math.PI*fold);
  const front = [{x:cx+rx,y:cy,radius:2.18-.56*fold}];
  curve(front,cx+rx,cy+ry*1.18,cx-rx*.81,cy+ry*1.47,
    cx-rx*(.65-.32*opening),cy+ry*.30,1.16,9);
  curve(front,cx-rx*(.68-.24*opening),cy-ry*.22,cx-rx*.31,cy-ry*.40,
    cx-rx*.18,cy-ry*(.18+.65*opening),.14,5);
  return {x,y,side,scale,far,sections:front};
}

export function drawKrakenGrabs(c: Pens, bodies: readonly Body[], bases: readonly Base[] | undefined,
    tick: number, sx: number, sy: number): Grips | undefined {
  const scale = Math.min(sx,sy);
  let byId: Map<number,Body> | undefined, grips: Grips | undefined;
  for (const caster of bodies) {
    const {unit} = caster;
    if (unit.kind !== "kraken" || (!unit.hp && tick > (unit.lastHitTick ?? -Infinity) + 2)) continue;
    const grab = unit.grab && tick >= unit.grab.tick ? unit.grab : caster.from.grab;
    if (!grab || !tentacleExtension(tick-grab.tick)) continue;
    if (unit.warpedTick !== undefined && unit.warpedTick >= grab.tick && tick >= unit.warpedTick) continue;
    byId ??= new Map(bodies.map(b => [b.unit.id,b]));
    // Draw the second arm on the far side of the first.
    for (let i = grab.targets.length - 1; i >= 0; i--) {
      const opening = grab.targets[i], drawn = byId.get(opening.id);
      const keep = drawn ? undefined : bases?.find(base => base.id === opening.id);
      const limit = UNIT_DEFINITIONS.kraken.reach + BASE_RADIUS + UNIT_DEFINITIONS.kraken.grip + 12;
      if (Math.hypot(opening.x-caster.x/sx,opening.y-caster.y/sy) > limit) continue;
      const warp = drawn?.unit.warpedTick;
      const jumped = warp !== undefined && warp >= grab.tick && warp <= tick;
      const nearOpening = drawn && Math.hypot(drawn.x/sx-opening.x,drawn.y/sy-opening.y) <= UNIT_DEFINITIONS.kraken.grip + 44;
      const tracking = drawn && nearOpening && !jumped;
      const age = jumped ? Math.max(tick-grab.tick, 9+(tick-warp)*2) : tick-grab.tick;
      if (!tentacleExtension(age)) continue;
      const center = tracking ? drawn : {x:opening.x*sx, y:opening.y*sy};
      const radius = keep ? BASE_RADIUS * TOWER_ART_SCALE : (drawn?.radius ?? 11*scale) / scale;
      const target = {x:center.x, y:center.y+(keep ? -4.3 : .12*radius)*scale};
      const dx = opening.x-caster.x/sx;
      const side = Math.abs(dx)>4 ? Math.sign(dx) : Math.abs(unit.aimX)>.08 ? Math.sign(unit.aimX) : ARMIES[unit.team].facing;
      // Fan the two arms toward their opening targets. Keep that curvature
      // as the victims are pulled together, even when their routes cross.
      const vertical = Math.max(-1,Math.min(1,(opening.y-caster.y/sy)/24));
      const bias = Math.min(1,Math.abs(dx)/22)*Math.abs(vertical);
      const bendSide = (i ? -.9 : 1)*(1-bias) + vertical*bias;
      const tip = drawArm(c,caster,target,Math.max(4,radius*(keep ? .88 : 1.03)),side,scale,age,i>0,!!keep,bendSide);
      if (drawn && tracking && age <= 9.5) {
        grips ??= new Map();
        const tips = grips.get(opening.id);
        if (tips) tips.push(tip); else grips.set(opening.id,[tip]);
      } else drawKrakenTips(c,[tip]);
    }
  }
  return grips;
}
