import type { CharacterPose } from "./character-pose.ts";
import { drawBody, drawUnitShadow, INK } from "./characters.ts";
import type { Unit } from "./simulation.ts";

interface Stamp {
  pen: CanvasRenderingContext2D;
  frame: number;
  snapshot: Unit;
  side: number;
  flash: number;
  paintTick: number;
  pose: CharacterPose;
  lastSeen: number;
}

// In a crowd, paint each soldier's own drawing into a small transparent tile.
// Positions, projectiles, transformations and scenery still use every display frame.
let frameTicks = 4;
const stamps = new Map<number, Stamp>();
let frame = 0;
let previousTick = -1;
let pixelsPerCssPixel = 1;

export function prepareCrowd(count: number, tick: number, ratio: number) {
  if (count < 48 || tick < previousTick || ratio !== pixelsPerCssPixel) stamps.clear();
  previousTick = tick;
  pixelsPerCssPixel = ratio;
  if (count < 48) return false;
  frameTicks = count >= 128 ? 8 : 4;
  for (const [id, stamp] of stamps) if (stamp.lastSeen < frame) stamps.delete(id);
  frame++;
  return true;
}

const rimColor = [1, 3, 5].map(offset => Number.parseInt(INK.slice(offset, offset + 2), 16));

function tintDamage(pen: CanvasRenderingContext2D, intensity: number) {
  const {width, height} = pen.canvas;
  const image = pen.getImageData(0, 0, width, height);
  const data = image.data;
  const edge = Math.max(1, Math.round(1.4 * pixelsPerCssPixel));
  const dx = 4 * edge, dy = dx * width;
  for (let y = edge; y < height - edge; y++) {
    for (let x = edge, i = (y * width + edge) * 4; x < width - edge; x++, i += 4) {
      if (data[i + 3] === 0) continue;
      const inner = Math.min(data[i-dx+3], data[i+dx+3], data[i-dy+3], data[i+dy+3]) / 255;
      for (let channel = 0; channel < 3; channel++) {
        const tint = rimColor[channel] + (255 - rimColor[channel]) * inner;
        data[i+channel] += (tint - data[i+channel]) * intensity;
      }
    }
  }
  pen.putImageData(image, 0, 0);
}

function actionChanged(a: Unit, b: Unit) {
  return a.kind !== b.kind || a.team !== b.team || !!a.hp !== !!b.hp ||
    a.targetId !== b.targetId || a.lastAttackTick !== b.lastAttackTick ||
    a.lastHitTick !== b.lastHitTick || a.lastAttentionTick !== b.lastAttentionTick ||
    a.lastDrawTick !== b.lastDrawTick || a.lastChargeTick !== b.lastChargeTick ||
    a.lastBlockTick !== b.lastBlockTick || a.lastBraceTick !== b.lastBraceTick ||
    a.lastChargeReadyTick !== b.lastChargeReadyTick || a.lastStartleTick !== b.lastStartleTick ||
    a.windup?.since !== b.windup?.since || a.lastSmashTick !== b.lastSmashTick ||
    a.lastSwallow?.tick !== b.lastSwallow?.tick || a.arc?.tick !== b.arc?.tick ||
    a.emberUntil !== b.emberUntil || a.lastHatchTick !== b.lastHatchTick ||
    a.wrappingSince !== b.wrappingSince || a.constructingSince !== b.constructingSince ||
    a.stunnedUntil !== b.stunnedUntil || a.frozenAt !== b.frozenAt || a.soul?.tick !== b.soul?.tick ||
    a.lastSpawnTick !== b.lastSpawnTick || a.lastSqueakTick !== b.lastSqueakTick || a.beam?.tick !== b.beam?.tick;
}

function visiblyMoved(a: CharacterPose, b: CharacterPose) {
  return Math.abs(a.step - b.step) > .12 || Math.abs(a.lift - b.lift) > .15 ||
    Math.abs(a.pitch - b.pitch) > .07 || Math.abs(a.lookX - b.lookX) > .16 || Math.abs(a.lookY - b.lookY) > .16 ||
    Math.abs(a.blink - b.blink) > .15 || Math.abs(a.breath - b.breath) > .18 || Math.abs(a.pace - b.pace) > .1 ||
    Math.abs(a.ready - b.ready) > .08 || Math.abs(a.guard - b.guard) > .1 || Math.abs(a.hurt - b.hurt) > .08 ||
    Math.abs(a.strike - b.strike) > .08 || Math.abs(a.loose - b.loose) > .08 || Math.abs(a.peek - b.peek) > .1 ||
    Math.abs(a.duck - b.duck) > .1 || Math.abs(a.cornered - b.cornered) > .1;
}

export function drawCrowdUnit(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number,
  pose: CharacterPose, unit: Unit, tick: number) {
  const scale = radius / 11;
  const large = unit.kind === "phoenix" || unit.kind === "cyclops";
  const infantry = unit.kind === "warrior" || unit.kind === "archer";
  const halfWidth = large ? 53 : unit.kind === "archer" ? 31 : 37;
  const top = large ? 54 : infantry ? 30 : 37;
  const height = top + (large ? 33 : infantry ? 16 : 23);
  const width = 2 * halfWidth;
  const pixels = scale * pixelsPerCssPixel;
  const w = Math.max(1, Math.ceil(pixels * width));
  const h = Math.max(1, Math.ceil(pixels * height));
  const poseFrame = Math.floor((tick + unit.id % frameTicks) / frameTicks);
  const flash = Math.ceil(4 * pose.hitFlash);
  let stamp = stamps.get(unit.id);
  if (!stamp) {
    const pen = document.createElement("canvas").getContext("2d", {willReadFrequently: true})!;
    stamp = {pen, frame: -1, snapshot: unit, flash, side: pose.side, lastSeen: frame, pose, paintTick: -Infinity};
    stamps.set(unit.id, stamp);
  }
  const {pen} = stamp;
  const resized = pen.canvas.width !== w || pen.canvas.height !== h;
  // A network snapshot can contain the next attack before its interpolated
  // display time. Refresh again precisely when the drawn timeline crosses it.
  const due = (event: number | null | undefined) => event != null && event > stamp.paintTick && event <= tick;
  const eventStarted = due(unit.lastAttackTick) || due(unit.lastAttentionTick) || due(unit.lastDrawTick) ||
    due(unit.lastBraceTick) || due(unit.arc?.tick) || due(unit.windup?.since) || due(unit.lastSmashTick);
  const changingPose = stamp.frame !== poseFrame && (!infantry || visiblyMoved(stamp.pose, pose));
  if (resized || changingPose || eventStarted || stamp.side !== pose.side || stamp.flash !== flash || actionChanged(stamp.snapshot, unit)) {
    if (resized) {
      pen.canvas.width = w;
      pen.canvas.height = h;
    } else {
      pen.clearRect(0, 0, w, h);
    }
    pen.save();
    pen.setTransform(pixels * pose.side, 0, 0, pixels, halfWidth * pixels, top * pixels);
    drawBody(pen, unit.team, unit.kind, pose, unit, tick);
    pen.restore();
    if (flash) tintDamage(pen, pose.hitFlash);
    stamp.side = pose.side;
    stamp.flash = flash;
    stamp.snapshot = unit;
    stamp.paintTick = tick;
    stamp.pose = pose;
  }
  stamp.frame = poseFrame;
  stamp.lastSeen = frame;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawUnitShadow(ctx, unit.kind, unit, pose, tick);
  ctx.restore();
  ctx.drawImage(pen.canvas, x - halfWidth * scale, y - top * scale, w / pixelsPerCssPixel, h / pixelsPerCssPixel);
}
