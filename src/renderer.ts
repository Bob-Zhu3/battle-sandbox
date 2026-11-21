import { ARENA, boundCenter, type Team } from "./simulation.ts";
import type { World } from "./room-protocol.ts";
import { type ArenaPoint } from "./deployment.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";
import { drawFieldSpell } from "./magic-art.ts";
import { drawMeteor } from "./meteor-art.ts";
import { stoneMarker } from "./siege-magic-art.ts";
import { sunbeam } from "./tower-art.ts";
import { drawTrail, drawTunnel, drawChange, drawSoul } from "./field-effects.ts";
import { drawChain, drawConditions, drawGroundEffect, drawSpecialShot, drawStun } from "./combat-art.ts";
import { drawKeep } from "./keeps.ts";
import { ARMIES, campFor, type MatchMode } from "./battlefield.ts";
import { characterPose, HIT_FLASH_TICKS, restingPose } from "./character-pose.ts";
import { drawFallen, drawUnitToken, INK, palette } from "./characters.ts";

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number, side: Team, length: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale * length, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The front of the shaft follows the simulated tip at bow height.
  ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-2, 0);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.stroke();
  ctx.strokeStyle = "#ffd073"; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, 0); ctx.lineTo(-14, -3); ctx.lineTo(-17, -3);
  ctx.lineTo(-15, 0); ctx.lineTo(-17, 3); ctx.lineTo(-14, 3); ctx.closePath();
  ctx.fillStyle = palette[side].light; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = .85; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-5.5, -2.8); ctx.lineTo(-4.3, 0); ctx.lineTo(-5.5, 2.8); ctx.closePath();
  ctx.fillStyle = "#fff1c6"; ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawDivider(ctx: CanvasRenderingContext2D, w: number, h: number, empty: boolean, mode: MatchMode) {
  ctx.save();
  ctx.strokeStyle = "#78926080";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 8]);
  const x = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, Math.min(140, h * .24));
  if (empty) {
    ctx.lineTo(x, h * .46 - 53);
    ctx.moveTo(x, h * .46 + 54);
  }
  ctx.lineTo(x, h - Math.min(108, h * .22));
  if (mode === "ffa") { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); }
  ctx.stroke();
  ctx.restore();
}

export function drawArena(ctx: CanvasRenderingContext2D, previous: World, current: World, blend: number, deploying = false, preview: readonly ArenaPoint[] = [], brush: UnitKind = "warrior", view: { ownTeam?: Team; showIds?: boolean; mode?: MatchMode } = {}) {
  const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight;
  if (!w || !h) return;
  ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.height / h, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // Keep pointer input and rendering in the same arena coordinates at every viewport size.
  const sx = w / ARENA.width, sy = h / ARENA.height;
  const scale = Math.min(sx, sy);
  if (view.mode) {
    if (view.ownTeam && brush !== "miner") {
      const camp = campFor(view.mode, view.ownTeam);
      ctx.beginPath(); ctx.rect(0, 0, w, h);
      ctx.rect(camp.x * sx, camp.y * sy, camp.width * sx, camp.height * sy);
      ctx.fillStyle = deploying ? "rgba(47, 62, 48, .13)" : "rgba(47, 62, 48, .045)"; ctx.fill("evenodd");
      ctx.fillStyle = ARMIES[view.ownTeam].coat + "12";
      ctx.fillRect(camp.x * sx, camp.y * sy, camp.width * sx, camp.height * sy);
    }
    drawDivider(ctx, w, h, deploying && !current.units.length && !preview.length, view.mode);
  }

  const tick = previous.tick + (current.tick - previous.tick) * blend;
  for (const unit of current.units) drawTrail(ctx,unit,tick,sx,sy);
  for (const effect of current.effects ?? []) drawGroundEffect(ctx, effect, tick, sx, sy);
  for (const spell of current.spells ?? []) drawFieldSpell(ctx, spell, tick, sx, sy);
  for (const shot of current.arrows) if (shot.kind==="stone" && shot.landTick!==undefined) {
    const left=shot.landTick-current.tick;
    stoneMarker(ctx,shot.x+shot.vx*left,shot.y+shot.vy*left,tick,shot.landTick,sx,sy,shot.team);
  }
  const targets = [...current.units, ...(current.bases ?? [])];
  const byId = new Map(targets.map(target => [target.id, target]));
  for (const base of current.bases ?? []) {
    drawKeep(ctx, base, base.x*sx, base.y*sy, scale, tick);
    if (base.hp && (base.stunnedUntil ?? 0)>tick) drawStun(ctx,base.x*sx,base.y*sy-24*scale,scale,tick,base.id);
  }
  const prior = new Map(previous.units.map(unit => [unit.id, unit]));
  const scoops = new Map<number, (typeof current.units)[number]>();
  for (const caster of current.units) {
    const swing = caster.windup;
    if (!caster.hp || swing?.kind !== "swallow" || scoops.has(swing.targetId)) continue;
    const meal = byId.get(swing.targetId);
    if (meal?.kind !== "base" && meal && meal.hp > 0 && meal.hp <= UNIT_DEFINITIONS.cyclops.swallowHp &&
        Math.hypot(meal.x-caster.x,meal.y-caster.y) <= UNIT_DEFINITIONS.cyclops.swallowRange+3) scoops.set(meal.id,caster);
  }
  const bodies = current.units.map(unit => {
    const from = prior.get(unit.id) ?? unit;
    return { unit, from, x: (from.x + (unit.x - from.x) * blend) * sx, y: (from.y + (unit.y - from.y) * blend) * sy };
  }).sort((a, b) => a.y - b.y || a.unit.id - b.unit.id);
  for (const {unit,x,y} of bodies) {
    if (!unit.hp || unit.wrappingSince === undefined || unit.targetId === null) continue;
    const patient = byId.get(unit.targetId);
    if (!patient || !patient.hp || patient.team !== unit.team) continue;
    const progress = Math.min(1,(tick-unit.wrappingSince+1)/16);
    const ex = x+(patient.x*sx-x)*progress, ey = y+(patient.y*sy-y)*progress;
    ctx.save(); ctx.strokeStyle = unit.kind === "engineer" ? "#b78c4a" : "#fff6db";
    ctx.lineWidth=2.8*scale;ctx.setLineDash([4*scale,2*scale]);ctx.beginPath();
    ctx.moveTo(x,y-2*scale);ctx.quadraticCurveTo((x+ex)/2,(y+ey)/2+5*scale,ex,ey-2*scale);ctx.stroke();ctx.restore();
  }
  for (const { unit, from, x, y } of bodies) {
    if (unit.hp || unit.lastHitTick === null || unit.swallowedTick !== undefined) continue;
    const age = Math.max(0, tick - unit.lastHitTick);
    if (age < 48) {
      const side = unit.aimX < 0 ? -1 : 1;
      const radius = UNIT_DEFINITIONS[unit.kind].radius * scale;
      // A base retreat also timestamps the fallen pose, but only combat kills
      // earn a killer in a match. Keep the struck body visible for its flash.
      const combatKill = !current.bases || unit.killedBy !== undefined;
      if (combatKill && age < HIT_FLASH_TICKS) {
        const pose = characterPose(unit, unit.targetId === null ? undefined : byId.get(unit.targetId), tick, unit.walkDistance, from.lastHitTick);
        drawUnitToken(ctx, x, y, radius, unit.team, unit.kind, pose, unit, tick);
      } else {
        const fallAge = combatKill ? (age - HIT_FLASH_TICKS) * 48 / (48 - HIT_FLASH_TICKS) : age;
        drawFallen(ctx, x, y, radius, unit.team, unit.kind, side, fallAge);
      }
    }
  }
  for (const { unit, from, x, y } of bodies) {
    if (!unit.hp) continue;
    if (unit.tunnel) {drawTunnel(ctx,unit,x,y,tick,sx,sy); continue;}
    const travel = from.walkDistance + (unit.walkDistance - from.walkDistance) * blend;
    const pose = deploying ? restingPose(ARMIES[unit.team].facing)
      : characterPose(unit, unit.targetId === null ? undefined : byId.get(unit.targetId), tick, travel, from.lastHitTick);
    const r = UNIT_DEFINITIONS[unit.kind].radius * scale;
    const hand = scoops.get(unit.id);
    if (hand) {
      const lift = Math.max(0, Math.min(1, (tick-hand.windup!.since-3)/(UNIT_DEFINITIONS.cyclops.swallowTicks-3)));
      const mouthX = hand.x*sx + (hand.aimX<0?-1:1)*9*scale, mouthY = hand.y*sy-12*scale;
      drawUnitToken(ctx,x+(mouthX-x)*lift,y+(mouthY-y)*lift-12*scale*Math.sin(Math.PI*lift),r*(1-.82*lift),unit.team,unit.kind,pose,unit,tick);
    } else drawUnitToken(ctx, x, y, r, unit.team, unit.kind, pose, unit, tick);
    if (unit.hex || unit.unhexedTick !== undefined || unit.zombified) drawChange(ctx,unit,x,y,scale,tick);
    if (unit.soul) drawSoul(ctx,unit,x,y,tick,sx,sy);
    if (unit.burn || unit.poison || (unit.rootedUntil ?? 0)>tick || (unit.stunnedUntil ?? 0)>tick || (unit.slowUntil ?? 0)>tick) drawConditions(ctx,unit,x,y,r,scale,tick);
    if (unit.lastTreatedTick !== undefined && tick - unit.lastTreatedTick < 16) {
      ctx.save();ctx.globalAlpha=1-(tick-unit.lastTreatedTick)/16;ctx.strokeStyle="#fff7cc";ctx.lineWidth=2*scale;
      ctx.beginPath();ctx.arc(x,y-r*.4,r*.85,0,Math.PI*1.5);ctx.stroke();ctx.restore();
    }
  }
  for (const u of current.units) if (u.arc) drawChain(ctx,u.arc,tick,sx,sy);
  for (const u of current.units) if (u.kind==="sunlens" && u.targetId!==null) sunbeam(ctx,u,byId.get(u.targetId),tick,sx,sy);
  for (const arrow of current.arrows) {
    const rewind = arrow.releasedTick === current.tick ? 0 : 1 - blend;
    const x = (arrow.x - arrow.vx * rewind) * sx;
    const y = (arrow.y - arrow.vy * rewind) * sy;
    const length = Math.min(1, Math.max(0, tick - arrow.releasedTick) / 3);
    if (arrow.kind === "stone" || arrow.kind === "bomb" || arrow.kind === "ice" || arrow.kind === "bullet" || arrow.kind === "venom" || arrow.kind === "balloon" || arrow.kind === "hex") {
      drawSpecialShot(ctx,arrow,x,y,Math.atan2(arrow.vy*sy,arrow.vx*sx),scale,tick);
    } else if (length > 0) {
      const height=arrow.kind==="bolt" ? 7+15*Math.max(0,1-(tick-arrow.releasedTick)/22) : 7;
      drawArrow(ctx,x,y-height*scale,Math.atan2(arrow.vy*sy,arrow.vx*sx),scale*(arrow.kind==="dart"?.73:1),arrow.team,length);
    }
  }
  for (const spell of current.spells ?? []) if (spell.kind === "meteor") drawMeteor(ctx,spell,tick,sx,sy);
  if (view.showIds) {
    ctx.save();
    ctx.font = '800 16px "Barlow Condensed", sans-serif';
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#f8f3df";
    ctx.fillStyle = INK;
    for (const unit of current.units) {
      const left = !deploying && ARMIES[unit.team].facing > 0;
      const offset = UNIT_DEFINITIONS[unit.kind].radius * scale + 5;
      const x = unit.x * sx + (left ? -offset : offset);
      const y = unit.y * sy;
      const label = "#" + unit.id + (deploying ? "" : " · " + unit.hp + " HP");
      ctx.textAlign = left ? "right" : "left";
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = .55;
  const radius = UNIT_DEFINITIONS[brush].radius;
  for (const point of preview) {
    const x = boundCenter(point.x, ARENA.width, radius), y = boundCenter(point.y, ARENA.height, radius);
    drawUnitToken(ctx, x * sx, y * sy, radius * scale, view.ownTeam ?? "red", brush);
  }
  ctx.restore();
}
