import type { Arrow } from "./arrows.ts";
import { ARMIES, type Team } from "./battlefield.ts";
import type { GroundEffect } from "./conditions.ts";
import { cut, INK, line, oval, type Pens } from "./ink.ts";
import { SPELLS, type FieldSpell } from "./spells.ts";
import type { Target, Unit } from "./simulation.ts";
import { TOWER_ART_SCALE } from "./tower-art.ts";

const circle = 2 * Math.PI;

function gate(c: Pens, size: number, open: number, phase: number, team: Team, entrance: boolean) {
  const dye = ARMIES[team];
  c.save();
  c.scale(size * open, size * (.3 + .7 * open) * .48);
  oval(c, 0, 0, 1.05, 1.08, "#383147");
  oval(c, 0, 0, .92, .92, dye.coat);
  oval(c, 0, 0, .74, .75, "#352d50");
  oval(c, .06, -.08, .45, .45, "#23243c");
  c.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a = phase + i * circle / 3;
    c.beginPath();
    c.arc(0, 0, .83, a, a + 1.06);
    c.strokeStyle = i === 1 ? dye.light : "#ffefc7"; c.lineWidth = .095; c.stroke();
    c.beginPath();
    c.arc(0, 0, .58, -a, -a + .7);
    c.strokeStyle = "#ae9cda"; c.lineWidth = .06; c.stroke();
    const p = (phase / circle * (entrance ? -1 : 1) + i / 3) % 1;
    const sweep = (p + 1) % 1;
    const r = .17 + .45 * sweep;
    oval(c, Math.cos(a + sweep) * r, Math.sin(a + sweep) * r, .055, .078, "#ede2ff");
  }
  c.restore();
}

export function wormholeIcon(c: Pens) {
  c.save(); c.translate(-5.1, 4.8); c.rotate(-.27);
  gate(c, 7.4, 1, .2, "violet", true); c.restore();
  c.save(); c.translate(5, -4.5); c.rotate(-.27);
  gate(c, 7.4, 1, 1.7, "violet", false); c.restore();
  c.beginPath(); c.moveTo(-4.7, 2.7); c.bezierCurveTo(-7, -1.8, 1.3, -.2, 2.9, -4);
  c.strokeStyle = "#74628f"; c.lineWidth = 1.3; c.stroke();
  cut(c, "M1.2 -4.7 L4.6 -5 L3 -2.1Z", "#f5cc88", .65);
}

export function drawWormhole(c: Pens, spell: FieldSpell, tick: number, sx: number, sy: number) {
  const {delay, duration} = SPELLS.wormhole;
  const age = tick - spell.startTick;
  if (age < 0 || age >= duration) return;
  const k = Math.min(sx, sy), phase = age * .11 + spell.id;
  const open = Math.max(.08, Math.min(1, (age + 3) / Math.max(3, delay * .65), (duration - age) / 12));
  const x = spell.x * sx, y = spell.y * sy;
  c.save(); c.translate(x, y); gate(c, 19*k, open, phase, spell.team, false); c.restore();
  if (spell.fromX === undefined || spell.fromY === undefined) return;
  const ox = spell.fromX * sx, oy = spell.fromY * sy;
  c.save(); c.translate(ox, oy); gate(c, 19*k, open, -phase, spell.team, true); c.restore();
  const passage = age - delay;
  if (passage < 0 || passage > 12 || spell.portalUnitId === undefined) return;
  // A few motes cross the gap only on transfer. The two mouths remain legible in a crowd.
  c.save();
  for (let i = 0; i < 4; i++) {
    const t = (passage + 1 - i * 1.4) / 7;
    if (t < 0 || t > 1) continue;
    const px = ox + (x - ox) * t, py = oy + (y - oy) * t - 9*k*Math.sin(t*Math.PI);
    c.globalAlpha = .75 * Math.sin(t*Math.PI);
    oval(c, px, py, (3 - .4*i)*k, (2.1 - .2*i)*k, i % 2 ? ARMIES[spell.team].hem : "#ad84c1");
  }
  c.restore();
}

export function isAttackTrace(effect: GroundEffect) {
  return effect.kind === "prism" || effect.kind === "gaze" || effect.kind === "breath" || effect.kind === "harpoon";
}

function rope(c: Pens, length: number, sag: number) {
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(length * .55, sag, length, 0);
  c.strokeStyle = "#685540"; c.lineWidth = 2.2; c.stroke();
  c.strokeStyle = "#e7c67d"; c.lineWidth = .9; c.stroke();
}

function fireBreath(c: Pens, length: number, radius: number, age: number) {
  const progress = Math.min(1, (age + 3) / 7);
  const broad = Math.max(5, radius * progress * (.80 + .18 * Math.sin(age * .4)));
  const tail = Math.max(0, (age - 10) / 12) * length;
  if (tail >= length) return;
  const span = length - tail;
  c.translate(tail, 0);
  // Lobes roll down the outside of the plume. The bright inner jet stops sooner.
  for (let i = 0; i < 3; i++) {
    const width = broad * (1 - i * .28), tip = span * (1 - i * .16);
    const flicker = Math.sin(age * .53 + i * 2.4);
    c.beginPath(); c.moveTo(0, -1);
    c.bezierCurveTo(tip*.36, -width*.12, tip*.29, -width*.71, tip*.55, -width*.52);
    c.bezierCurveTo(tip*.69, -width*.90, tip*.79, -width*.48, tip*.90, -width*(.90+.13*flicker));
    c.quadraticCurveTo(tip*.88,-width*.57,tip, -width*(.32+.10*flicker));
    c.quadraticCurveTo(tip*.89, -width*.12, tip*1.03, width*.08);
    c.quadraticCurveTo(tip*.91, width*.20, tip*.96, width*(.57-.13*flicker));
    c.quadraticCurveTo(tip*.83, width*.39, tip*.76, width*.60);
    c.quadraticCurveTo(tip*.61, width*.87, tip*.45, width*.29);
    c.quadraticCurveTo(tip*.28, width*.24, 0, 1); c.closePath();
    c.fillStyle = ["#d76a45b5", "#f49b44e0", "#ffe58b"][i]; c.fill();
  }
  if (age > 2) {
    for (let i = 0; i < 5; i++) {
      const p = ((age * .068 + i * .227) % 1), side = i % 2 ? -1 : 1;
      c.globalAlpha *= .94;
      oval(c, span * (.52 + .50*p), side*broad*(.67+.45*p) - 3*p, 1.8 - p*.7, 1.2 - p*.45, "#e38a47");
    }
  }
}

export function drawAttackTrace(c: Pens, e: GroundEffect, tick: number, sx: number, sy: number) {
  const age = tick - e.tick;
  const life = e.kind === "breath" ? 22 : e.kind === "gaze" ? 17 : e.kind === "harpoon" ? 10 : 12;
  if (age < 0 || age >= life || e.fromX === undefined || e.fromY === undefined) return;
  const k = Math.min(sx, sy);
  const headHeight = e.kind === "prism" ? 19*TOWER_ART_SCALE : e.kind === "harpoon" ? 13*TOWER_ART_SCALE : e.kind === "breath" ? 21 : 16;
  const wx = e.x - e.fromX, wy = e.y - e.fromY, worldLength = Math.hypot(wx,wy);
  // The dragon turns its head left or right even when its target is directly above it.
  const side = Math.abs(wx) > .08 * worldLength ? Math.sign(wx) : ARMIES[e.team].facing;
  const mouth = e.kind === "breath" ? Math.min(40,worldLength*.38)*side*k : 0;
  const dx = wx*sx-mouth, dy = wy*sy + (headHeight - 7)*k;
  const cone = (e.kind === "breath" || e.kind === "gaze") && worldLength > 0;
  const length = cone ? worldLength : Math.hypot(dx, dy) / k;
  if (length < .5) return;
  c.save(); c.translate(e.fromX*sx+mouth, e.fromY*sy - headHeight*k);
  if (cone) {
    // A landscape arena can be painted on a portrait viewport. Project both axes
    // of a damage cone so its colored footprint still reaches the affected troops.
    c.transform(dx/worldLength,dy/worldLength,-wy*sx/worldLength,wx*sy/worldLength,0,0);
  } else {
    c.rotate(Math.atan2(dy,dx)); c.scale(k,k);
  }
  c.globalAlpha = Math.min(1, (life - age) / (life * .55)); c.lineJoin = c.lineCap = "round";
  if (e.kind === "prism") {
    const wobble = Math.sin(age*.68) * .45;
    c.beginPath(); c.moveTo(0,-1); c.lineTo(length, -3.4+wobble); c.lineTo(length,3.4+wobble); c.lineTo(0,1); c.closePath();
    c.fillStyle = "#bba3e75c"; c.fill();
    line(c,0,-.6,length,-1.9+wobble,"#c790b1",1.25);
    line(c,0,.8,length,1.9+wobble,"#72b5c4",1.25);
    line(c,0,0,length,wobble,"#fff2ae",2.1);
    if (age < 7) { c.translate(length,0); c.rotate(age*.16); cut(c,"M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2Z","#fff4cb",.55); }
  } else if (e.kind === "gaze") {
    const reach = length, width = e.radius;
    c.beginPath(); c.moveTo(0,0); c.lineTo(reach,-width); c.quadraticCurveTo(reach*1.04,0,reach,width); c.closePath();
    c.fillStyle = "#97aa8533"; c.fill();
    for (let i = 0; i < 2; i++) {
      const p = ((age + 3 - 4*i) / 13);
      if (p <= 0 || p > 1) continue;
      const x = length*p, w = e.radius*p*.9;
      c.beginPath(); c.moveTo(x,-w); c.quadraticCurveTo(x+7,0,x,w);
      c.strokeStyle = i ? "#d8d7aa" : "#728c77"; c.lineWidth = 1.4; c.stroke();
    }
  } else if (e.kind === "breath") {
    fireBreath(c,length,e.radius,age);
  } else {
    const lengthLeft = length * (1 - .38*age/life);
    rope(c, lengthLeft, 2.2*Math.sin(age*.88)*(1-age/life));
    c.translate(lengthLeft,0);
    cut(c,"M-6 -2 L1 -1.6 L3 0 L-1 2.5 L-4.6 3.4 L-2.4 1 L-6 1Z","#b7c6c0",.75);
  }
  c.restore();
}

export function drawBreach(c: Pens, e: GroundEffect, tick: number, sx: number, sy: number) {
  const age = tick - e.tick;
  if (age < 0 || age > 28) return;
  const t = age/28, r = e.radius*Math.min(1,(age+3)/12);
  c.save(); c.translate(e.x*sx,e.y*sy); c.scale(sx,sy); c.globalAlpha = 1-t;
  c.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const a=i*circle/6+.18;
    c.beginPath(); c.ellipse(0,0,r,r*.74,0,a,a+.64); c.strokeStyle="#b99d69"; c.lineWidth=2.5-t; c.stroke();
    const distance = r*(.62 + .21*(i%2)) + t*6;
    const x=Math.cos(a)*distance, y=Math.sin(a)*distance*.74 - (5+i%3*3)*Math.sin(t*Math.PI);
    oval(c,x,y,2.9-t*1.4,1.8-t*.65,i%2?"#b68a60":"#d4b27c");
  }
  c.restore();
}

export function groundingLine(c: Pens, u: Unit, x: number, y: number, radius: number, tick: number) {
  const remaining=(u.groundedUntil ?? 0)-tick;
  if (remaining <= 0) return;
  const side=u.aimX<0?-1:1;
  c.save();c.translate(x,y);c.scale(side*radius/11,radius/11);
  c.globalAlpha=Math.min(1,remaining/7);
  // The tether drags across the ground until the winch lets go.
  c.beginPath();c.moveTo(-4,-1.5);c.quadraticCurveTo(-7,3.8,-5.2,5.1);
  c.quadraticCurveTo(-9,8,-13,6.4);
  c.lineCap="round";c.strokeStyle="#685640";c.lineWidth=1.85;c.stroke();
  c.strokeStyle="#dfbf74";c.lineWidth=.72;c.stroke();
  cut(c,"M-5 -.5 Q-7.2 .7 -7.4 -1.6 L-7 -3.6 L-6.3 -1.6 L-4.8 -2.7Z","#a7b6b2",.68);
  if (u.knockback) {
    line(c,-11,7,-15,7.8,"#b29e7d",1.1);
    line(c,-8,9.1,-10.3,9.4,"#c9b992",.8);
  }
  c.restore();
}

function pumpkin(c: Pens, team: Team) {
  cut(c,"M-5.5 -.9 Q-6.3 -4.7 -3.1 -5.6 Q-.7 -6.2 .1 -5.5 Q3.2 -6.4 5 -4.3 Q7 -1.3 5 2.7 Q3 5.1 -.6 4.5 Q-5.1 5.2 -5.5 -.9Z","#ec984e",1.1);
  cut(c,"M-3.4 -1.2 L-1 -.1 L-2.9 .7Z M.5 0 L3.5 -1.7 L2.7 .8Z M-2.1 2 L-.6 2.3 L.2 1.8 L1.2 2.3 L3 1.6 Q1.2 4.1 -2.1 2Z","#5e463a",0);
  line(c,-2.8,-.6,-2.1,-.17,"#ffe28a",.58); line(c,2,-.45,2.9,-.95,"#ffe28a",.58);
  line(c,-.2,-5.1,.9,-7.2,"#728354",1.6);
  cut(c,"M-3.3 3.4 Q-.7 4.5 2.6 3.5 L2.3 4.8 L-2.3 5.2 L-4.4 6Z",ARMIES[team].coat,.72);
}

export function droppedHead(c: Pens, unit: Unit, tick: number, sx: number, sy: number) {
  if (!unit.hp || unit.headUntil === undefined || unit.headLandedTick === undefined || !unit.headSpot || tick < unit.headLandedTick) return;
  const k=Math.min(sx,sy), age=tick-unit.headLandedTick;
  const settle=Math.max(0,1-age/13);
  c.save(); c.translate(unit.headSpot.x*sx,unit.headSpot.y*sy); c.scale(k,k);
  oval(c,0,1,5.1,1.8,"#4d514c38");
  c.translate(0,-4-3.2*settle*Math.abs(Math.sin(age*.47)));
  c.rotate(.22+.65*settle*Math.sin(age*.54));pumpkin(c,unit.team);
  c.restore();
}

export function drawLegendShot(c: Pens, shot: Arrow, x: number, y: number, angle: number, k: number, tick: number,
  caster: Target | undefined, sx: number, sy: number) {
  const age = Math.max(0,tick-shot.releasedTick);
  const launch = Math.max(0,1-age/12);
  const lift = shot.kind === "head" ? 12 + 3*Math.sin(age*.18) : shot.kind === "harpoon" ? 9 + (13*TOWER_ART_SCALE-9)*launch :
    8 + 8*(TOWER_ART_SCALE-1)*launch + 4*Math.sin(Math.min(1, age/30)*Math.PI);
  if (shot.kind === "harpoon" && caster?.hp) {
    const startX = caster.x*sx, startY = caster.y*sy-13*k*TOWER_ART_SCALE, dx = x-startX, dy = y-lift*k-startY;
    const length = Math.hypot(dx,dy)/k;
    c.save();c.translate(startX,startY);c.rotate(Math.atan2(dy,dx));c.scale(k,k);
    rope(c,length,Math.min(6,length*.09)*Math.cos(Math.atan2(dy,dx)));c.restore();
  }
  c.save(); c.translate(x,y);
  if (shot.kind !== "harpoon") oval(c,0,1.5*k, (shot.kind==="head"?4.1:2.4)*k,1.2*k,"#4d514c32");
  c.translate(0,-lift*k); c.scale(k,k);
  if (shot.kind === "snowball") {
    c.rotate(angle); line(c,-9,0,-2,0,"#b4cfd5",1.5);
    oval(c,0,0,4.5,4.05,"#718e97"); oval(c,.2,-.35,3.8,3.4,"#d8edf0");
    oval(c,-.8,-1.2,2,1.4,"#fffdf2");
  } else if (shot.kind === "harpoon") {
    c.rotate(angle); line(c,-10,0,1,0,"#584c3b",2.8); line(c,-9.5,-.45,-2,-.45,"#d8ad66",1);
    cut(c,"M-5.4 -3.2 L1.6 -1.25 L4.5 0 L.1 2.8 L-4.9 4 L-2.2 1 L-5.4 .7Z","#b9c9c3",.95);
  } else {
    c.save(); c.rotate(angle);
    const ember = Math.sin(age*.52);
    c.beginPath(); c.moveTo(-2,-3); c.quadraticCurveTo(-5,-4.5,-8.5-ember*2,-2.4);
    c.quadraticCurveTo(-8,-1,-11+ember,0); c.quadraticCurveTo(-7.4,1.35,-3,1); c.closePath();
    c.fillStyle="#e68a43b0"; c.fill();
    oval(c,-12.6+ember,-1.7,1,.74,"#e8a047"); c.restore();
    c.rotate((shot.vx<0?-1:1)*age*.21);
    pumpkin(c,shot.team);
  }
  c.restore();
}
