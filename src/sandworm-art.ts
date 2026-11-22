import { ARMIES } from "./battlefield.ts";
import type { CharacterPose } from "./character-pose.ts";
import { cut, FACE, INK, line, oval, type Dye, type Pens } from "./ink.ts";
import { initialWormBody } from "./sandworm.ts";
import type { Unit } from "./simulation.ts";
import type { Tunnel } from "./tunnels.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

interface Point { x: number; y: number }
interface Ring extends Point { radius: number; tx: number; ty: number }

const shellWidth = [9.2, 10.5, 10.8, 10, 9.1, 8, 6.8, 5.6, 4, 1.6];
const count = shellWidth.length;
// All positions are filled from the two snapshots on every draw. Pause, seeking
// and a newly connected browser need no local history to reconstruct a worm.
const trail: Point[] = Array.from({length: count}, () => ({x: 0, y: 0}));
const rings: Ring[] = Array.from({length: count}, () => ({x: 0, y: 0, radius: 0, tx: 1, ty: 0}));
const coil = [[7,-9],[.5,-7],[-6,-5.5],[-12,-2.5],[-13,2.7],[-8,6.3],[-.8,6.7],[5.8,4.8],[7.5,1],[5,-.1]];
const stoneDye = {coat: "#96958a", hem: "#696c64", light: "#d8d5c8"};
interface ShellDye {coat: string; hem: string; light: string}
const headOutline = "M-10 -3.2 Q-10.5 -8.4 -4.65 -10.65 Q-.5 -12.05 4.4 -9.3 Q9.4 -10.4 13.1 -6.8 Q13.4 -3.25 11.35 -.35 Q13.2 3.75 11.1 7.05 Q7.75 10.1 2.9 8.35 Q-1.95 11.1 -6.7 8.45 Q-10.9 5.8 -9.25 1.35Z";

function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function profile(facing: number) {
  for (let i = 0; i < count; i++) {
    const a = rings[Math.max(0, i - 1)], b = rings[Math.min(count - 1, i + 1)];
    const dx = a.x - b.x, dy = a.y - b.y, length = Math.hypot(dx, dy);
    rings[i].tx = length > .15 ? dx / length : facing;
    rings[i].ty = length > .15 ? dy / length : 0;
  }
}

// Curve the flanks through the joints so the overlapping shells sit on one
// continuous, flexible belly. This also gives the whole animal one ground shadow.
function flank(c: CanvasPath, lo: number, hi: number, side: number, start: boolean) {
  const step = hi >= lo ? 1 : -1;
  let lastX = 0, lastY = 0;
  for (let i = lo; ; i += step) {
    const ring = rings[i];
    const x = ring.x - side * ring.ty * ring.radius, y = ring.y + side * ring.tx * ring.radius;
    if (i === lo) { if (start) c.moveTo(x, y); else c.lineTo(x, y); }
    else c.quadraticCurveTo(lastX, lastY, (lastX + x) / 2, (lastY + y) / 2);
    lastX = x; lastY = y;
    if (i === hi) break;
  }
  c.lineTo(lastX, lastY);
}

function belly(c: CanvasPath, first: number, last: number) {
  flank(c, first, last, 1, true);
  const tip = rings[last];
  c.quadraticCurveTo(tip.x - tip.tx * tip.radius, tip.y - tip.ty * tip.radius,
    tip.x + tip.ty * tip.radius, tip.y - tip.tx * tip.radius);
  flank(c, last, first, -1, false);
  const nose = rings[first];
  c.quadraticCurveTo(nose.x + nose.tx * nose.radius, nose.y + nose.ty * nose.radius,
    nose.x - nose.ty * nose.radius, nose.y + nose.tx * nose.radius);
  c.closePath();
}

function shell(c: Pens, d: ShellDye, i: number, stone: boolean) {
  const band = i === 2 || i === 5 || i === 8;
  const back = band ? d.coat : stone ? "#aaa99c" : "#d5a56d";
  cut(c, "M-7 .4 Q-7.8 -5.9 -4.8 -8.75 Q-.3 -11.6 5.55 -7.65 Q3.1 -4.35 3.25 -.3 Q3.5 4.2 5.55 7.35 Q1.1 10.45 -3.75 8.55 Q-7 6.75 -7 .4Z", back, 1.08);
  cut(c, "M-5.55 4.4 Q-.2 6.85 3.55 4.65 L5.2 7.25 Q1.25 9.4 -3.4 8.15 Q-5.4 7.25 -5.55 4.4Z", band ? d.hem : stone ? "#8a8b80" : "#ae7d56", 0);
  cut(c, "M-5.25 -4.75 Q-3.1 -9.55 1.85 -8.45 Q2.75 -8.25 3 -7.65 Q-1.75 -7.2 -3.85 -3.6Z", band ? d.light : stone ? "#d4d0c3" : "#f4d59a", 0);
  if (!band) line(c, -4.75, 2.8, -4, 4.1, stone ? "#82857b" : "#996b50", .85);
}

const shellSheets = new Map<string, HTMLCanvasElement>();
function stampedShell(c: Pens, d: ShellDye, i: number, stone: boolean) {
  let sheet = shellSheets.get(d.coat);
  if (!sheet) {
    sheet = document.createElement("canvas"); sheet.width = 96; sheet.height = 56;
    const pen = sheet.getContext("2d")!;
    pen.lineJoin = pen.lineCap = "round";
    pen.setTransform(2, 0, 0, 2, 24, 28); shell(pen, d, 1, stone);
    pen.translate(24, 0); shell(pen, d, 2, stone);
    shellSheets.set(d.coat, sheet);
  }
  c.drawImage(sheet, i % 3 === 2 ? 48 : 0, 0, 48, 56, -12, -14, 24, 28);
}

function maw(c: Pens, d: ShellDye, open: number, p: CharacterPose, stone: boolean) {
  const sand = stone ? "#b7b5a8" : "#dcaa71", ivory = stone ? "#e3dfd0" : FACE;
  // The soft opening and three curved mandibles share one collar. The mouth
  // goes from a suspicious slit to an open dark throat on its real emergence.
  cut(c, headOutline, sand, 1.45);
  cut(c, "M-10 -2.4 Q-10.4 -8.35 -4.7 -10.55 Q-1.95 -11.55 .45 -10.55 Q-3.3 -7.55 -4.05 -2.15 Q-4.95 3.85 -1.2 8.8 Q-6.5 10.5 -9.2 5.65 Q-10.4 2.65 -9.1 -.2Z", d.coat, 1.05);
  cut(c, "M-8.3 -4.1 Q-7.75 -7.15 -5.05 -8.95 Q-3.25 -9.85 -2.2 -9.55 Q-5.15 -7.4 -6.45 -3.45Z", d.light, 0);
  c.save(); c.translate(5.1, -.4); c.rotate(-.13 + .1 * p.pitch);
  c.scale(.64 + .38 * open, .69 + .41 * open);
  cut(c, "M-3.7 -6.15 Q.4 -9.5 4.75 -6.75 Q8.35 -4.65 7.55 .35 Q7.1 4.7 3 6.85 Q-1.55 8.2 -4.2 4 Q-7.15 -.65 -3.7 -6.15Z", stone ? "#52534e" : "#543d42", 1);
  cut(c, "M-.85 3.45 Q2.9 1.25 5.05 -1.75 Q6.55 2.75 2.45 4.85 Q.4 5.45 -.85 3.45Z", stone ? "#97948a" : "#b87168", 0);
  cut(c, "M-2.95 -5.55 L-.9 -6.65 L-.65 -3.05Z M2.6 -6.8 L4.95 -5.85 L2.85 -3.1Z M4.65 3.85 L2.35 5.7 L2.65 2.45Z M-.2 5.3 L-2.35 4.05 L-.8 1.9Z", ivory, .5);
  c.restore();
  c.save(); c.translate(1.1, -5.15); c.rotate(-.34 * open);
  cut(c, "M-3.55 -.7 Q-.1 -6.85 4.5 -7.3 Q8.25 -7.55 11.85 -5.05 Q6.85 -5.35 4.75 -1.4 Q2.65 2.15 -.45 2.25Z", sand, 1.12);
  cut(c, "M3.05 -4.7 Q6.95 -7.65 11.4 -5.05 Q7.1 -5.3 5.1 -2.55Z", ivory, .55);
  c.restore();
  c.save(); c.translate(1.75, 4.65); c.rotate(.36 * open);
  cut(c, "M-3.9 -.8 Q-.35 -2.35 2.6 -.7 Q5.65 2.5 11.15 .95 Q9.3 5.65 4.6 6.2 Q-.5 6.95 -3.9 2.3Z", sand, 1.12);
  cut(c, "M5.25 2.65 Q8 3.05 10.95 1.15 Q9.7 4.5 6.4 5.15Z", ivory, .55);
  c.restore();
  cut(c, "M-2.95 -2.55 Q-.95 -4.9 1.15 -4.1 Q3.25 -2.75 4.5 -1.35 Q2.5 .1 1.05 1.55 Q-1.8 3.1 -3.85 .95Z", sand, .85);
  oval(c, -1.15, -1.45, 1.25, p.blink > .65 ? .42 : 1.02, INK);
  if (p.blink < .65) oval(c, -.85, -1.72, .47, .41, stone ? "#e1d9c1" : "#ffe7a3");
}

const headSheets = new Map<string, HTMLCanvasElement>();
function stampedMaw(c: Pens, d: ShellDye, open: number, p: CharacterPose, stone: boolean) {
  const jaw = Math.min(5, Math.round(open * 5)), blink = p.blink > .65 ? 1 : 0;
  const key = d.coat + jaw + blink;
  let sheet = headSheets.get(key);
  if (!sheet) {
    sheet = document.createElement("canvas"); sheet.width = 160; sheet.height = 80;
    const pen = sheet.getContext("2d")!;
    pen.lineCap = pen.lineJoin = "round";
    pen.setTransform(2, 0, 0, 2, 40, 40);
    maw(pen, d, jaw / 5, {...p, blink, pitch: 0}, stone);
    // Tint precisely the open or closed jaws, including their projecting tips.
    const tile = pen.getImageData(0, 0, 80, 80), raw = tile.data;
    for (let y = 2; y < 78; y++) for (let x = 2, i = (y * 80 + x) * 4; x < 78; x++, i += 4) {
      if (!raw[i + 3]) continue;
      const inner = Math.min(raw[i - 8 + 3], raw[i + 8 + 3], raw[i - 640 + 3], raw[i + 640 + 3]) / 255;
      raw[i] = 38 + 217 * inner; raw[i+1] = 51 + 204 * inner; raw[i+2] = 47 + 208 * inner;
    }
    pen.putImageData(tile, 80, 0);
    headSheets.set(key, sheet);
  }
  if (p.hitFlash < .99) c.drawImage(sheet, 0, 0, 80, 80, -20, -20, 40, 40);
  if (p.hitFlash > 0) {
    c.save(); c.globalAlpha *= p.hitFlash;
    c.drawImage(sheet, 80, 0, 80, 80, -20, -20, 40, 40); c.restore();
  }
}

function body(c: Pens, d: ShellDye, p: CharacterPose, openness: number, stone: boolean, crowd: boolean, shadow: boolean, tilt = 0) {
  let first = 0, last = count - 1;
  while (first < count && rings[first].radius < .35) first++;
  while (last > first && rings[last].radius < .35) last--;
  if (first >= count) return;
  profile(p.side);
  c.lineCap = "round"; c.lineJoin = "round";
  const flash = p.hitFlash;
  if (last > first) {
    const outline = new Path2D(); belly(outline, first, last);
    if (shadow) {
      c.save(); c.translate(.8, 3.8);
      c.fillStyle = "rgba(64,62,47,.18)"; c.fill(outline); c.restore();
    }
    c.fillStyle = flash >= .99 ? "#fff" : stone ? "#777a71" : "#aa7757";
    c.fill(outline); c.strokeStyle = INK; c.lineWidth = 1.55; c.stroke(outline);
    if (flash > 0 && flash < .99) { c.save(); c.globalAlpha *= flash; c.fillStyle = "#fff"; c.fill(outline); c.restore(); }
    if (flash < .99) {
      c.save(); c.globalAlpha *= 1 - flash;
      for (let i = last; i >= Math.max(1,first); i--) {
        const r = rings[i], up = Math.abs(r.tx) > .15 ? Math.sign(r.tx) : p.side;
        // Plates keep their length around a bend while narrowing toward the tail.
        const height = r.radius / 10, length = Math.min(1.13, height * 1.5);
        c.save(); c.transform(r.tx * length, r.ty * length, -r.ty * up * height, r.tx * up * height, r.x, r.y);
        if (crowd) stampedShell(c, d, i, stone);
        else shell(c, d, i, stone);
        c.restore();
      }
      c.restore();
    }
  }
  if (first === 0) {
    const h = rings[0], up = Math.abs(h.tx) > .18 ? Math.sign(h.tx) : p.side;
    c.save(); c.transform(h.tx, h.ty, -h.ty * up, h.tx * up, h.x, h.y);
    c.rotate(tilt);
    const size = h.radius / shellWidth[0];
    c.scale(size, size);
    if (crowd || flash > 0) stampedMaw(c, d, openness, p, stone);
    else maw(c, d, openness, p, stone);
    c.restore();
  }
}

export function drawSandwormPortrait(c: Pens, d: Dye, p: CharacterPose) {
  for (let i = 0; i < count; i++) {
    const r = rings[i];
    r.x = coil[i][0]; r.y = coil[i][1]; r.radius = shellWidth[i] * (i === 0 ? .89 : .66);
  }
  body(c, d, p, .37, false, false, false, -.16);
}

// The far side is broken first. Loose dirt crosses the near lip so this looks
// like a hole in the same white field, including in a crowded fight.
function opening(c: Pens, x: number, y: number, amount: number, tick: number, seed: number) {
  if (amount < .035) return;
  c.save(); c.translate(x, y); c.scale(amount, .55 + .45 * amount);
  cut(c, "M-17 .35 Q-14 -3.35 -10 -3.3 L-7.4 -5.15 Q-2.85 -4.6 .05 -5.65 Q4.75 -6.35 8 -3.85 Q13 -4.35 15.9 -.9 Q19.1 1.2 14.55 2.65 Q10.7 4.8 7.4 4.5 Q2.5 6.2 -2.2 5.05 Q-8.4 6 -10.05 3.55 Q-14.55 3.75 -17 .35Z", "#cca273", .72);
  cut(c, "M-12.85 .4 Q-11.15 -2.2 -6.75 -2.2 Q-2.25 -4.25 2.15 -3.45 Q7.6 -4.25 12.9 -.5 Q11.65 1.6 7.85 2.05 Q1.45 4.05 -4.2 2.55 Q-9 2.9 -12.85 .4Z", "#725a47", .7);
  const hop = .8 * Math.sin(tick * .32 + seed);
  oval(c, -12.1, 2.8 + hop * .2, 2.8, 1.05, "#e8c896");
  oval(c, 10.65, 2.9 - hop * .22, 3.1, 1.2, "#e7c28e");
  c.restore();
}

function underground(c: Pens, tunnel: Tunnel, head: Point, sx: number, sy: number, tick: number, seed: number) {
  const age = tick - tunnel.start;
  const fromX = (tunnel.fromX - head.x) * sx, fromY = (tunnel.fromY - head.y) * sy;
  const toX = (tunnel.toX - head.x) * sx, toY = (tunnel.toY - head.y) * sy;
  opening(c, fromX, fromY, 1 - smooth((age - 3) / 13), tick, seed);
  const arrive = smooth((tick - (tunnel.end - 13)) / 13);
  if (arrive > 0) {
    c.save(); c.translate(toX, toY); c.scale(.45 + .55 * arrive, .5 + .5 * arrive);
    c.strokeStyle = "#b38d65"; c.lineWidth = 1.15; c.beginPath();
    c.moveTo(-14, 4); c.lineTo(-5, 1); c.lineTo(-8, -.7); c.lineTo(1.5, -1.75);
    c.moveTo(7, .2); c.lineTo(11, -2.35); c.lineTo(17, -.8); c.stroke(); c.restore();
  }
  const shown = smooth((age + 2) / 8);
  if (shown > .05) {
    // A continuous split in the soil connects the high breaking crest to the
    // settling tail of the wake, even when the tunnel bends across the field.
    for (let i = 0; i < count; i++) {
      const r = rings[i];
      r.x = trail[i].x; r.y = trail[i].y + .85;
      r.radius = Math.max(.65, 5.35 - i * .94) * shown;
    }
    profile(1); c.beginPath(); belly(c, 0, 6);
    c.fillStyle = "#eddfc7"; c.fill();
  }
  // Crests roll through the same joint centers as the swimmer below. Each has
  // a steep nose, a pale collapsing back and a small loose stone alongside it.
  for (let i = 5; i >= 0; i--) {
    const a = trail[i], b = trail[i + 1];
    const dx = a.x - b.x, dy = a.y - b.y, span = Math.hypot(dx, dy) || 1;
    const tx = dx / span, ty = dy / span, up = tx < 0 ? -1 : 1;
    const roll = .5 + .5 * Math.sin(age * .22 - i * .95 + seed);
    const size = (1.35 - i * .176) * shown;
    if (size < .05) continue;
    c.save(); c.transform(tx, ty, -ty * up, tx * up, a.x, a.y);
    c.scale(size, size * (.8 + .3 * roll));
    if (i === 0 || i === 3) {
      cut(c, "M-10 2.75 Q-8.8 .85 -6.45 1.25 Q-3.85 .1 -2.2 -2.7 Q.2 -7.55 3.85 -6.9 Q6.45 -6.55 7.4 -3.25 Q8.4 -.65 11.5 1.55 Q8.1 3.25 4.8 2.65 Q.25 4.3 -4.1 3.2Z", "#d8b27b", .9);
      cut(c, "M-5.4 .9 Q-2.75 -.2 -.95 -3.1 Q.75 -6.25 3.65 -5.7 Q5.5 -5.4 6.1 -3.3 Q3.45 -4.8 1.45 -1.9 Q-1.55 1.3 -5.4 .9Z", "#f5dba7", 0);
    } else {
      cut(c, "M-8.3 2.05 Q-5.45 1.55 -2.1 -1.1 Q.3 -3.65 2.65 -3.75 Q6.15 -3.45 8.65 1.05 Q5.1 2.55 1.7 2.1 Q-3.55 3.3 -8.3 2.05Z", "#dfbd8a", .66);
    }
    if (i % 2 === 0) {
      c.save(); c.translate(-5.2 - 1.25 * roll, -4.3 - 2.9 * roll); c.rotate(-.4 + roll);
      cut(c, "M-1.9 .55 L-1.15 -1.3 Q.55 -2.05 1.55 -.65 L1.45 .85Z", "#bb9468", .4); c.restore();
    }
    if (i === 0) {
      c.save(); c.translate(-2.8 - 3.6 * roll, 5.45 + 1.9 * roll); c.rotate(-.48 + roll);
      cut(c, "M-1.5 .25 Q-1.5 -1.05 -.1 -1.45 L1.65 -.15 L.55 .95Z", "#d6b080", .5); c.restore();
    }
    c.restore();
  }
}

function readTrail(unit: Unit, from: Unit, weight: number, sx: number, sy: number) {
  const now = unit.wormBody?.length === count - 1 ? unit.wormBody : initialWormBody(unit);
  const old = from === unit ? now : from.wormBody?.length === count - 1 ? from.wormBody : initialWormBody(from);
  trail[0].x = 0; trail[0].y = 0;
  for (let i = 1; i < count; i++) {
    const a = old[i - 1], b = now[i - 1];
    trail[i].x = ((a.x - from.x) * (1 - weight) + (b.x - unit.x) * weight) * sx;
    trail[i].y = ((a.y - from.y) * (1 - weight) + (b.y - unit.y) * weight) * sy;
  }
}

// Find where the path actually passes through the lip. The tail can keep
// slipping into this stationary point after the buried head has moved on.
function jointAt(x: number, y: number) {
  let index = 0, best = Infinity;
  for (let i = 0; i < count - 1; i++) {
    const a = trail[i], b = trail[i + 1], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const gap = (x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2;
    if (gap < best) { best = gap; index = i + t; }
  }
  return index;
}

export function wormTunnelAt(unit: Unit, from: Unit, tick: number) {
  if (unit.tunnel && tick >= unit.tunnel.start) return unit.tunnel;
  if (from.tunnel && tick >= from.tunnel.start && tick < (unit.emergedTick ?? from.tunnel.end)) return from.tunnel;
}

export function drawFieldSandworm(c: Pens, unit: Unit, from: Unit, x: number, y: number, sx: number, sy: number,
    weight: number, tick: number, pose: CharacterPose, stone = false, crowd = false) {
  const scale = Math.min(sx, sy), dx = sx / scale, dy = sy / scale;
  readTrail(unit, from, weight, dx, dy);
  const head = {x: x / sx, y: y / sy};
  const tunnel = wormTunnelAt(unit, from, tick);
  const windup = unit.windup?.kind === "breach" ? unit.windup :
    unit.tunnel && tick < unit.tunnel.start && from.windup?.kind === "breach" ? from.windup : undefined;
  const age = tick - (unit.emergedTick ?? -Infinity);
  const surfacing = !tunnel && age >= 0 && age < 25;
  const q = windup && !tunnel && !surfacing ? smooth((tick - windup.since) / UNIT_DEFINITIONS.sandworm.windup) : 0;
  const leap = surfacing ? (1 - smooth((age - 4) / 16)) * (.72 + .28 * Math.sin(Math.min(1,age / 7) * Math.PI)) : 0;
  const dive = smooth((q - .45) / .55);
  const elapsed = tunnel ? tick - tunnel.start : 0;
  c.save(); c.translate(x, y); c.scale(scale, scale);
  if (tunnel) {
    underground(c, tunnel, head, dx, dy, tick, unit.id * .17);
    if (elapsed >= 13) { c.restore(); return; }
  } else if (surfacing || q > 0) opening(c, 0, 0, surfacing ? 1 - smooth((age - 3) / 22) : .82 * q, tick, unit.id);

  const swallowed = tunnel ? 1.45 + 8.6 * smooth(elapsed / 13) : dive * 1.45;
  const entry = tunnel ? jointAt((tunnel.fromX - head.x) * dx, (tunnel.fromY - head.y) * dy) : 0;
  const gait = from.walkDistance + (unit.walkDistance - from.walkDistance) * weight;
  const phase = tick * .037 + gait * .063 + unit.id * 1.7;
  for (let i = 0; i < count; i++) {
    const where = Math.min(count - 1, entry + Math.max(0, i - swallowed));
    const low = Math.floor(where), a = trail[low], b = trail[Math.min(count - 1, low + 1)];
    const face = trail[Math.max(0, low - 1)], back = trail[Math.min(count - 1, low + 1)];
    const tx = face.x - back.x, ty = face.y - back.y, len = Math.hypot(tx, ty) || 1;
    const ripple = Math.sin(phase - i * .76) * (.65 + 2.85 * pose.pace) * Math.sin(i * Math.PI / count);
    const up = surfacing ? smooth((age + 2.7 - i * 2) / 5.1) : 1;
    const skin = tunnel ? smooth(i - swallowed + .65) : i === 0 ? 1 - .55 * dive : smooth(i - swallowed + .8);
    const r = rings[i];
    r.x = a.x + (b.x - a.x) * (where - low) - ty / len * ripple;
    r.y = a.y + (b.y - a.y) * (where - low) + tx / len * ripple - 2.5 * skin;
    r.y -= leap * Math.max(0, 19 - i * 4.3);
    if (i === 0) r.y += 2 * dive - .55 * pose.breath;
    r.radius = shellWidth[i] * skin * up * (1 + .035 * Math.sin(phase - i * .95));
  }
  const mouth = Math.min(1, .16 + .15 * pose.ready + .79 * leap + .29 * q + .07 * Math.sin(phase));
  body(c, stone ? stoneDye : ARMIES[unit.team], pose, mouth, stone, crowd, !tunnel, -.36 * leap + .43 * dive);
  c.restore();
}
