import { phoenixFlight, restingPose, type CharacterPose } from "./character-pose.ts";
import type { Team, Unit } from "./simulation.ts";
import type { UnitKind } from "./units.ts";
import { ARMIES } from "./battlefield.ts";

import { drawSpecialist, fallenSpecialist } from "./roster-art.ts";
import { INK, oval, type Pens } from "./ink.ts";
import { infantry, infantryKind, fallenHead } from "./pixel-art/infantry.ts";
import { firebird } from "./pixel-art/firebird.ts";
import { frostRoyal, clockworkDrone, prismSpire } from "./pixel-art/specialists.ts";
import { indexPixels } from "./pixel-art/palette.ts";
export { INK } from "./ink.ts";
export const palette = ARMIES;

let specialistTile: Pens | undefined;

export function drawBody(c: Pens, team: Team, kind: UnitKind, pose: CharacterPose, unit: Unit | undefined, tick: number) {
  c.imageSmoothingEnabled = false;
  if (infantryKind(kind)) { infantry(c,team,kind,pose,unit,tick); return; }
  if (kind === "phoenix") { firebird(c,team,pose,unit,tick); return; }
  if (kind === "frostqueen") { frostRoyal(c,team,pose,unit,tick); return; }
  if (kind === "drone") { clockworkDrone(c,team,pose,unit,tick); return; }
  if (kind === "prism") { prismSpire(c,team,unit,tick); return; }
  // Give every other rig a fixed sprite resolution, including portraits and transformed troops.
  // A single scratch tile covers the longest wing, lance or cast. The crowd cache owns its copies.
  if (!specialistTile) {
    const tile = document.createElement("canvas");
    tile.width=120; tile.height=104;
    specialistTile=tile.getContext("2d",{willReadFrequently:true})!;
  }
  const pen=specialistTile;
  pen.clearRect(0,0,120,104);
  pen.save(); pen.translate(60,62); pen.imageSmoothingEnabled=false;
  pen.lineCap="round"; pen.lineJoin="round";
  drawSpecialist(pen,palette[team],kind,pose,unit,tick);
  pen.restore();
  const large = kind==="firedragon" || kind==="cyclops" || kind==="hydra" || kind==="kraken" || kind==="sandworm";
  const left=large?0:22, top=large?0:20, width=120-left*2, height=104-top;
  const pixels=pen.getImageData(left,top,width,height);
  indexPixels(pixels);
  pen.putImageData(pixels,left,top);
  c.drawImage(pen.canvas,left,top,width,height,left-60,top-62,width,height);
}

// The body and its ink silhouette exclude shadows, neighbors and trails.
const spriteExtent = 100;
const hitOutline = [[-1,0],[1,0],[0,-1],[0,1]] as const;
let hitLayer: Pens | undefined;
let hitInk: Pens | undefined;

export function drawUnitShadow(c: Pens, kind: UnitKind, unit: Unit | undefined, pose: CharacterPose, tick: number) {
  if (kind === "phoenix" && unit?.emberUntil === undefined) {
    const height = phoenixFlight(unit, pose, tick).height;
    c.save(); c.globalAlpha *= 1 - height * .025;
    oval(c, -.3, 8.7, 10.7 - height * .24, 3.1 - height * .055, "rgba(45,57,40,.27)"); c.restore();
  } else {
    oval(c, -.3, 8.7, kind === "warrior" ? 9.8 : 8.1, 2.8, "rgba(45,57,40,.22)");
  }
}

export function drawUnitToken(c: Pens, x: number, y: number, radius: number, team: Team, kind: UnitKind, pose = restingPose(ARMIES[team].facing), unit?: Unit, tick = 0) {
  c.save();
  c.translate(x, y);
  c.scale(radius / 11, radius / 11);
  drawUnitShadow(c, kind, unit, pose, tick);
  c.scale(pose.side, 1);
  const flash = pose.hitFlash;
  if (flash > 0) {
    const layer = hitLayer ??= document.createElement("canvas").getContext("2d")!;
    const ink = hitInk ??= document.createElement("canvas").getContext("2d")!;
    const transform = c.getTransform();
    const pixels = spriteExtent * Math.max(1, Math.ceil(Math.hypot(transform.a, transform.b)));
    if (layer.canvas.width !== layer.canvas.height || layer.canvas.width < pixels) {
      layer.canvas.width = layer.canvas.height = pixels;
      ink.canvas.width = ink.canvas.height = pixels;
    }
    // Filtered pixels at the crop edge can otherwise pick up the last larger sprite.
    layer.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    layer.save();
    layer.setTransform(pixels / spriteExtent, 0, 0, pixels / spriteExtent, pixels / 2, pixels / 2);
    drawBody(layer, team, kind, pose, unit, tick);
    layer.restore();
    // Keep a continuous dark rim even around a white shield or a tiny mouse.
    ink.clearRect(0, 0, ink.canvas.width, ink.canvas.height);
    ink.drawImage(layer.canvas, 0, 0, pixels, pixels, 0, 0, pixels, pixels);
    ink.save(); ink.globalCompositeOperation = "source-in"; ink.fillStyle = INK;
    ink.fillRect(0, 0, pixels, pixels); ink.restore();
    const edge = -spriteExtent / 2;
    const rim = Math.max(.72, Math.min(2.75, 15.4 / radius));
    c.save(); c.globalAlpha *= flash;
    for (const [dx,dy] of hitOutline) {
      c.drawImage(ink.canvas, 0, 0, pixels, pixels, edge + dx * rim, edge + dy * rim, spriteExtent, spriteExtent);
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
  if (kind === "warrior" || kind === "archer") fallenHead(c,team,kind);
  else fallenSpecialist(c, palette[team], kind);
  c.restore();
}
