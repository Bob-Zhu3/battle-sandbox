import { phoenixFlight, restingPose, type CharacterPose } from "./character-pose.ts";
import type { Team, Unit } from "./simulation.ts";
import type { UnitKind } from "./units.ts";
import { ARMIES } from "./battlefield.ts";

import { drawSpecialist, fallenSpecialist } from "./roster-art.ts";
import { INK, FACE, IRON, WOOD, shape, line, oval, type Pens, type Dye } from "./ink.ts";
export { INK } from "./ink.ts";
export const palette = ARMIES;

// All cut shapes are drawn in the same small profile, facing right, with the
// center of the footprint at (0,0). The two characters have different skeletons.
const shapes = {
  coat: new Path2D("M-6.45 -3.5 Q-5.65 -7 -.65 -6.15 Q3.8 -6.2 5.6 -2.7 Q7.15 .6 5.4 4.9 Q.5 7.35 -6.7 4.55Z"),
  skirt: new Path2D("M-6 1.95 Q-.3 3.8 5.15 1.8 L6.05 5.4 Q2.3 7.05 -.6 6.1 Q-4.5 7.05 -7.1 5.6Z"),
  helmet: new Path2D("M-8.35 -2.65 C-9.85 -8.4 -7.0 -12.75 -2.55 -13.5 Q3.6 -15.05 6.8 -9.7 Q8.35 -7.95 8.9 -5.55 Q6.6 -2.85 2.7 -2.7 Q-4.5 -.95 -8.35 -2.65Z"),
  brim: new Path2D("M-10.1 -3.7 Q-9.5 -5.25 -6 -5.15 Q-.6 -5.25 5.65 -7.05 Q9.1 -8.1 11.05 -5.7 Q9.55 -3.65 5.95 -3.15 Q-2.55 -1.4 -7.9 -1.3 Q-10.25 -1.35 -10.1 -3.7Z"),
  faceplate: new Path2D("M-6.25 -4 Q-.45 -6.25 6.75 -5.1 Q7.9 -3.45 7.25 -1.4 L7.7 -.35 Q6.8 2.35 3.55 3.55 Q-2.05 5.45 -5.65 1.55Z"),
  shield: new Path2D("M-4.65 -5.8 Q-1.25 -8.75 4.3 -7.25 Q5.7 -7 5.7 -4.95 L6.15 -.55 Q6.4 4.8 1.0 8.15 Q-4.8 6.15 -5.25 1.3Z"),
  shieldStripe: new Path2D("M-3.55 -5.8 Q-2.4 -6.65 -.95 -6.6 L3.85 4.8 Q3 6.05 1.65 6.75Z"),
  blade: new Path2D("M-1.8 0 L-1.5 -11 L.7 -16 L2.5 -11 L1.6 0 Z"),
  cloak: new Path2D("M-4.8 -4.3 Q.35 -7.6 4.15 -3.5 Q3.9 .3 5.0 2.15 Q5.75 4.05 7.25 4.75 Q4.95 6.8 1.25 6.45 Q-1.75 7.6 -4.5 5.85 Q-6 6.35 -7.45 5.45 Q-5.6 1.1 -4.8 -4.3Z"),
  hood: new Path2D("M-10.45 -9.6 Q-7.65 -9.65 -5.65 -11.35 Q-2.6 -15.6 1.5 -14.2 Q5.65 -14.3 7.65 -9.45 L9.05 -6.6 Q8.75 -3 5.9 -.8 Q.65 2.95 -4.55 1.3 Q-7.85 .55 -7.3 -3.9 Q-7.65 -7.15 -10.45 -9.6Z"),
  hoodFace: new Path2D("M-.05 -6.9 Q3.8 -9.2 7.85 -7.15 Q8 -3.9 5.75 -1.85 Q3.45 -.35 1.75 -1.65 Q.15 -3.25 -.05 -6.9Z"),
  feather: new Path2D("M-2.6 -9.95 C-6.75 -11 -10.65 -12.15 -11.3 -16.85 Q-7.0 -17.85 -3.9 -14.25 Q-2.35 -12.6 -2.6 -9.95Z"),
  quiver: new Path2D("M-9.35 -6.15 Q-7.9 -7.4 -5 -7.1 L-2.9 1.95 Q-2.8 4.25 -5.2 4.7 Q-6.8 4.85 -7.1 3.4Z"),
  bow: new Path2D("M-3 -11 C-3 -8 3 -7 3 0 C3 7 -3 8 -3 11"),
  scarf: new Path2D("M-4.0 -1.15 L-3.8 1.65 Q-5.8 4.7 -9.15 4.25 Q-12.1 4.35 -13.65 2 Q-9.55 2.8 -7.65 .15 Q-6.3 -1.15 -4.0 -1.15Z"),
};
function feet(c: Pens, p: CharacterPose, compact: boolean) {
  const stride = p.step * (compact ? 3.3 : 4.6);
  const spread = compact ? 3.6 : 2.8;
  for (const leg of [-1, 1]) {
    const hip = leg * spread;
    const foot = hip + leg * stride - p.peek * 1.4;
    const ground = 9 - Math.max(0, -leg * p.step) * 2.5;
    line(c, hip, 3 + p.duck * 2, foot, ground - 1, INK, compact ? 3.2 : 2.2);
    line(c, foot - 1, ground, foot + (compact ? 1.9 : 1.5), ground, INK, compact ? 3.8 : 2.8);
  }
}

function sword(c: Pens, dye: Dye, p: CharacterPose) {
  const wrist = -5.2 + 17.9 * p.strike;
  const wristY = -.3 - 3.3 * p.ready - 5.4 * p.strike;
  if (p.strike > .45) {
    line(c, .8, -1.5, wrist, wristY, INK, 3.8);
    line(c, 1, -1.6, wrist, wristY, dye.coat, 2.1);
  }
  c.save();
  c.translate(wrist, wristY);
  c.rotate(-.64 - .74 * p.ready + (2.12 + p.pitch * .86) * p.strike + .12 * p.step);
  c.scale(1, 1 + .23 * p.strike);
  shape(c, shapes.blade, "#f6efd4");
  line(c, -2.9, 0, 2.9, 0, INK, 2.6);
  line(c, -2.6, 0, 2.6, 0, WOOD, 1.4);
  oval(c, 0, 2.2, 1.6, 1.8, dye.hem);
  c.restore();
}

function warrior(c: Pens, dye: Dye, p: CharacterPose) {
  feet(c, p, true);
  c.save();
  c.translate(-2.7 * p.hurt + 2 * p.strike, -1.35 * p.lift + p.duck * 4.8 - p.breath);
  c.rotate(.055 * p.pace - .16 * p.hurt + .085 * p.strike);
  if (p.strike <= .45) sword(c, dye, p);
  shape(c, shapes.coat, dye.coat);
  shape(c, shapes.skirt, dye.hem, 1);
  c.save();
  c.translate(-1 + p.guard * .9 - p.duck * 1.6, -3 + p.duck * 1.2 + p.hurt);
  c.rotate(p.duck * .19 + p.pitch * .13);
  shape(c, shapes.faceplate, FACE);
  oval(c, 2.8 - 2.5 * p.duck, .55 + p.pitch * .7, 1.1, 1.45 - p.blink, INK);
  shape(c, shapes.helmet, IRON);
  line(c, -5.3, -8, -2.8, -10.5, "#f4efce", 1.25);
  shape(c, shapes.brim, dye.coat);
  c.restore();

  c.save();
  c.translate(5.7 + p.guard * 3.6 + p.strike, 4.3 - p.guard * 2.2 - p.duck * 11);
  c.rotate(-.13 + .20 * p.guard - .97 * p.duck - .14 * p.strike);
  shape(c, shapes.shield, dye.coat);
  shape(c, shapes.shieldStripe, dye.light, 0);
  oval(c, .9, -.1, 2.1, 2.3, INK); oval(c, 1.1, -.4, 1.2, 1.35, IRON);
  c.restore();
  if (p.strike > .45) sword(c, dye, p);
  c.restore();
}

function archer(c: Pens, dye: Dye, p: CharacterPose) {
  feet(c, p, false);
  c.save();
  c.translate(p.peek * 2.2 - p.hurt * 3.2, -p.lift * 1.65 - p.peek * 2 - p.breath);
  c.rotate(-.08 + p.pace * .17 - p.hurt * .12);
  line(c, -6, -3, -10, -10, WOOD, 1.4);
  line(c, -6, -3, -8.2, -11, FACE, 1.4);
  shape(c, shapes.quiver, "#886846");
  shape(c, shapes.cloak, dye.coat);
  line(c, -.2, -4, 1.5 + p.peek * 2.3, -5 - p.peek * 3.1, FACE, 2.8);
  c.save();
  c.translate(.5 + p.peek * 2.7 - p.loose * .9, -2 - p.peek * 2.4);
  c.rotate(p.pitch * .17 + p.peek * .12);
  shape(c, shapes.feather, WOOD, 1);
  shape(c, shapes.hood, dye.coat);
  shape(c, shapes.hoodFace, FACE, 1);
  oval(c, 5.6 + p.peek * .4, -4.9 + p.pitch * .72, 1, 1.45 - p.blink, INK);
  c.restore();
  c.save(); c.rotate(p.pace * .24 - p.peek * .12);
  shape(c, shapes.scarf, dye.light, .95); c.restore();
  line(c, -3, -2, 3, -1, dye.light, 1.8);

  // The nocking hand returns to the cheek, then snaps behind the hood on release.
  c.save();
  c.translate(.8, -.6);
  c.rotate(p.pitch);
  const handX = 7.2 + p.ready * 2.3 + p.loose * 2.2 - p.peek * 1.1;
  const handY = .8 - p.ready * 2 + p.peek * 4.4 + p.step * .75;
  line(c, 0, .7, handX, handY, INK, 2.8);
  c.save();
  c.translate(handX, handY);
  c.rotate(-.38 + p.ready * .30 + p.loose * .30 - p.peek * .47);
  c.strokeStyle = INK; c.lineWidth = 3; c.stroke(shapes.bow);
  c.strokeStyle = WOOD; c.lineWidth = 1.45; c.stroke(shapes.bow);
  const nock = -4.4 - 6.5 * p.ready + 2.1 * p.loose;
  c.strokeStyle = "#fff2d2"; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-3, -11); c.lineTo(nock, 0); c.lineTo(-3, 11); c.stroke();
  if (p.ready > .12) {
    line(c, nock, 0, nock + 13, 0, INK, 1.15);
    line(c, nock + 13, 0, nock + 10, -1.3, FACE, 1.35);
  }
  c.restore();
  line(c, -.7, 1, 1.8 - p.ready * 3.4 - p.loose * 7.5, .6 - p.ready * 3.3 - p.loose * 4, dye.hem, 2.6);
  oval(c, handX, handY, 1.45, 1.45, FACE);
  c.restore();
  c.restore();
}

function drawBody(c: Pens, team: Team, kind: UnitKind, pose: CharacterPose, unit: Unit | undefined, tick: number) {
  c.lineCap = "round"; c.lineJoin = "round";
  if (kind === "warrior") warrior(c, palette[team], pose);
  else if (kind === "archer") archer(c, palette[team], pose);
  else drawSpecialist(c, palette[team], kind, pose, unit, tick);
}

// One transparent layer fits any animated pose, including the outstretched
// lance and club. Tinting this layer leaves shadows, neighbors and trails alone.
const spriteExtent = 100;
const hitOutline = [[-.7,0],[.7,0],[0,-.7],[0,.7]] as const;
let hitLayer: Pens | undefined;

export function drawUnitToken(c: Pens, x: number, y: number, radius: number, team: Team, kind: UnitKind, pose = restingPose(ARMIES[team].facing), unit?: Unit, tick = 0) {
  c.save();
  c.translate(x, y);
  c.scale(radius / 11, radius / 11);
  if (kind === "phoenix" && unit?.emberUntil === undefined) {
    const height = phoenixFlight(unit, pose, tick).height;
    c.save(); c.globalAlpha *= 1 - height * .025;
    oval(c, -.3, 8.7, 10.7 - height * .24, 3.1 - height * .055, "rgba(45,57,40,.27)"); c.restore();
  } else {
    oval(c, -.3, 8.7, kind === "warrior" ? 9.8 : 8.1, 2.8, "rgba(45,57,40,.22)");
  }
  c.scale(pose.side, 1);
  const flash = pose.hitFlash;
  if (flash > 0) {
    const layer = hitLayer ??= document.createElement("canvas").getContext("2d")!;
    const transform = c.getTransform();
    const pixels = spriteExtent * Math.max(1, Math.ceil(Math.hypot(transform.a, transform.b)));
    if (layer.canvas.width !== layer.canvas.height || layer.canvas.width < pixels) {
      layer.canvas.width = layer.canvas.height = pixels;
    }
    // Filtered pixels at the crop edge can otherwise pick up the last larger sprite.
    layer.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    layer.save();
    layer.setTransform(pixels / spriteExtent, 0, 0, pixels / spriteExtent, pixels / 2, pixels / 2);
    drawBody(layer, team, kind, pose, unit, tick);
    layer.restore();
    // Leave a hairline of the original outline where two struck bodies overlap.
    const edge = -spriteExtent / 2;
    c.save(); c.globalAlpha *= .72 * flash;
    for (const [dx,dy] of hitOutline) {
      c.drawImage(layer.canvas, 0, 0, pixels, pixels, edge + dx, edge + dy, spriteExtent, spriteExtent);
    }
    c.restore();
    layer.save();
    layer.globalCompositeOperation = "source-atop";
    layer.globalAlpha = flash;
    layer.fillStyle = "#fff";
    layer.fillRect(0, 0, pixels, pixels);
    layer.restore();
    c.drawImage(layer.canvas, 0, 0, pixels, pixels, edge, edge, spriteExtent, spriteExtent);
  } else {
    drawBody(c, team, kind, pose, unit, tick);
  }
  c.restore();
}

export function drawFallen(c: Pens, x: number, y: number, radius: number, team: Team, kind: UnitKind, side: number, age: number) {
  const t = Math.min(1, age / 13);
  const flip = side * (1 - (1 - t) ** 2);
  c.save();
  c.translate(x, y);
  c.scale(radius / 11, radius / 11);
  c.globalAlpha = .82 * (1 - Math.min(1, age / 48) ** 2);
  oval(c, 0, 6, 8, 2, "rgba(45,57,40,.24)");
  c.translate(-flip * 3, 5 - 3 * Math.sin(Math.PI * t));
  c.scale(side * .8, .8);
  c.rotate(-.73 - Math.abs(flip) * .83);
  c.lineJoin = "round";
  if (kind === "warrior") {
    shape(c, shapes.helmet, IRON);
    shape(c, shapes.brim, palette[team].coat);
  } else if (kind === "archer") {
    shape(c, shapes.hood, palette[team].coat);
    shape(c, shapes.feather, WOOD, 1);
  } else fallenSpecialist(c, palette[team], kind);
  c.restore();
}
