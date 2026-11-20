import { ARMIES, TEAMS, type Team } from "./battlefield.ts";
import { phoenixFlight, type CharacterPose } from "./character-pose.ts";
import { cut, line, oval, type Dye, type Pens } from "./ink.ts";
import type { Unit } from "./simulation.ts";
import { UNIT_DEFINITIONS } from "./units.ts";

// The painted body and plumes are shared. Only the flight feathers vary by army.
type Part = readonly [x: number, y: number, width: number, height: number];
const body: Part = [4,4,234,216];
const plume: Part = [260,4,244,109], fork: Part = [516,4,244,118];
function wingPair(x: number): { near: Part; far: Part } {
  return {near: [x,227,244,153], far: [x,387,244,153]};
}
const wings: Record<Team, ReturnType<typeof wingPair>> = {
  red: wingPair(4), blue: wingPair(260), violet: wingPair(516), amber: wingPair(772),
};
const sheet = new Image();
export let phoenixArtLoaded = false;
async function loadArt() {
  sheet.src = new URL("./art/phoenix.webp", import.meta.url).href;
  await sheet.decode();
  phoenixArtLoaded = true;
  return true;
}
export const phoenixArtReady = loadArt().catch(() => false);

type BentPart = { image: HTMLCanvasElement; top: number };
const bends = new Map<Part, Map<number, BentPart>>();

// A feather bends more at the tip than at the shoulder. Warp narrow strips
// with shared integer edges, before rotating the whole piece on the field.
// Each painted part has at most 16 bent shapes, reused across birds and frames.
function bentPart(part: Part, bend: number): BentPart {
  let poses = bends.get(part);
  if (!poses) {
    poses = new Map();
    bends.set(part, poses);
  }
  const cached = poses.get(bend);
  if (cached) return cached;

  const [sx, sy, width, height] = part;
  const distance = bend * width * .022;
  const top = Math.floor(Math.min(0, distance)) - 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height + Math.ceil(Math.max(0,distance)) - top + 1;
  const c = canvas.getContext("2d", { willReadFrequently: true })!;
  const offset = (x: number) => distance * Math.max(0, 1 - x / (width * .93)) ** 2;
  for (let x = 0; x < width; x += 12) {
    const strip = Math.min(12, width - x);
    const left = offset(x), right = offset(x + strip);
    c.setTransform(1, (right - left) / strip, 0, 1, x, left - top);
    c.drawImage(sheet, sx + x, sy, strip, height, 0, 0, strip, height);
  }
  const result = { image: canvas, top };
  poses.set(bend, result);
  return result;
}

function feather(c: Pens, part: Part, width: number, pivotX: number, pivotY: number, flex: number) {
  const [sx,sy,sw,sh] = part;
  const scale = width/sw, left = -pivotX*width, top = -pivotY*sh*scale;
  const bend = Math.round(Math.max(-1,Math.min(1,flex))*8);
  if (bend === 0) {
    c.drawImage(sheet,sx,sy,sw,sh,left,top,width,sh*scale);
  } else {
    const warped = bentPart(part,bend);
    c.drawImage(warped.image,left,top+warped.top*scale,width,warped.image.height*scale);
  }
}

function drawBody(c: Pens, rake: number) {
  const [sx,sy,sw,sh] = body;
  const width = 34.2, scale = width/sw, x = -16.4, y = -24;
  // The hinge follows the feather line above the ankles. The breast keeps
  // its shape while both painted talons reach forward on contact.
  const ankle = 186;
  c.drawImage(sheet,sx,sy,sw,ankle,x,y,width,ankle*scale);
  c.save(); c.translate(x,y+ankle*scale);
  c.transform(1,0,1.16*rake,1+.77*rake,0,0);
  c.drawImage(sheet,sx,sy+ankle-1,sw,sh-ankle+1,0,-scale,width,(sh-ankle+1)*scale);
  c.restore();
}

function ember(c: Pens, unit: Unit, tick: number, until: number) {
  const time = tick + unit.id*11, glow = .5 + .5*Math.sin(time*.2);
  const near = 1-Math.min(1,(until-tick)/UNIT_DEFINITIONS.phoenix.hatchTicks);
  oval(c,0,5,11,3,"#865a49"); line(c,-8,5,6,7,"#4f4441",2); line(c,-5,7,8,3,"#5b423c",2);
  c.translate(0,3); c.rotate(Math.sin(time*.42)*near*near*.24); c.translate(0,-3-near*1.6);
  cut(c,"M-7 2 Q-9 -3 -5 -8 Q-4 -12 0 -15 Q6 -11 8 -5 Q10 2 5 5 Q-4 8 -7 2Z","#8c4545",1.5);
  cut(c,"M-5 2 L0 -2 L-2 -6 L3 -11 L1 -5 L4 -2 L-3 4Z","#ffd26a",.5);
  oval(c,4,-5,1,1,"#ffeaa3");
  for (let i=0;i<3;i++) {
    const phase=(time*.035+i/3)%1;
    oval(c,-6+i*5+Math.sin(time*.09+i),-7-phase*11,1.2,1.4,"#ffb64e");
  }
  c.strokeStyle="#ffeab1"; c.lineWidth=1; c.globalAlpha=.5+glow*.4; c.beginPath();
  c.arc(0,0,10,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,near)); c.stroke();
}

export function phoenix(c: Pens, dye: Dye, pose: CharacterPose, unit: Unit | undefined, tick: number) {
  if (unit?.emberUntil !== undefined) { ember(c,unit,tick,unit.emberUntil); return; }
  const f = phoenixFlight(unit,pose,tick);
  c.translate(3.4*f.talons,-f.height); c.rotate(f.pitch);
  if (!phoenixArtLoaded) {
    cut(c,"M-18 7 Q-8 7 -4 -3 Q-9 -7 -10 -17 Q-4 -13 0 -8 Q4 -7 7 -12 Q12 -16 16 -11 L19 -9 L15 -8 Q10 3 3 5 Q-1 6 -5 4 Q-11 10 -18 7Z",dye.coat,1);
    return;
  }
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  const stroke = unit ? f.wing : .93;
  const team = unit?.team ?? TEAMS.find(team => ARMIES[team] === dye) ?? "red";
  c.save(); c.translate(3.6,-4.3); c.rotate(.35+.73*stroke-.08*f.wrist);
  c.scale(1-.16*f.talons,.72+.08*f.pullUp);
  feather(c,wings[team].far,32.7,.93,.53,.52*f.wrist-.15); c.restore();

  const echo = Math.sin(tick*2*Math.PI/54 + (unit?.id ?? 0)*2.39996 - 1.6);
  c.save(); c.translate(-9.2,2.5);
  c.save(); c.rotate(-.14-.11*echo-.13*f.pullUp);
  feather(c,fork,38,.94,.13,-.53*echo-.21*f.pullUp); c.restore();
  c.rotate(.11+.12*f.tail+.08*f.talons);
  feather(c,plume,33.4,.93,.21,.69*f.tail-.22*f.pullUp); c.restore();

  c.save(); c.rotate(.20+.13*pose.pace+pose.pitch*.09-.065*f.tail);
  drawBody(c,f.talons); c.restore();
  c.save(); c.translate(.1,-1.3); c.rotate(.05+.87*stroke);
  c.scale(1-.23*f.talons,.74+.19*Math.abs(stroke)-.14*f.talons);
  feather(c,wings[team].near,37,.93,.54,f.wrist*.88+.18*f.tail);
  c.restore();
}
