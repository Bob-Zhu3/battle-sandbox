import type { Pens } from "./ink.ts";
import { drawEffect } from "./pixel-art/effect-player.ts";
import { stamp } from "./pixel-art/stamps.ts";
import { SPELLS, type FieldSpell } from "./spells.ts";

const { delay, duration, radius } = SPELLS.meteor;
const flightScale = 4;

// Right-facing at native resolution. The dark plates and split molten seam
// have the same silhouette in flight and on the smaller roster card.
const rock = [
  "..........RRROO.........",
  ".......RRROOOYYY........",
  ".....RROObbbOOOYY.......",
  "....ROObbKKbbrrOYY......",
  "...RROObKKKbbrrrOYY.....",
  "..ROOYYObbKbbrrOOOYY....",
  ".ROYYYOYYObbbrOOrrOYY...",
  ".ROYbbbrYYOOOYYObbrOYY..",
  "ROObKKbbrrYYWWWObbbrOY..",
  "ROObKKKbbbOYWHHWOObrOYY.",
  "ROYObbbbbbOYYHHWWYYOOYY.",
  "ROOYOOrrrOOYHHHWWOOOYOY.",
  ".ROOYYYOOOYYHHWOOrrbOYY.",
  "..ROOOWWWYYWHHWOrbbbOYY.",
  ".ROrrOOYYYWHHWOrbbKbOYY.",
  "ROObbbbrrYWWYOrbbKKbOYY.",
  "ROObbbbbbOYOOrrbKKbOYY..",
  ".ROrrrbbbOOObrrbbbOOYY..",
  "..ROOrrbOOYOObrrrOOYY...",
  "....ROOOYYOrrrOOOYYY....",
  ".....RROYObrrOOYYY......",
  ".......ROOOOOYYY........",
  ".........ROOYY..........",
  "..........ROO...........",
];
function drawRock(c: Pens) {
  stamp(c,"red",rock,-12,-12);
}

const portraitFlame = [
  ".........R................",
  "..........RO..............",
  "...O.......ROO......RRR...",
  "....OO.....RROOO..RROOYY..",
  "........RRRROYYOOOYYWWWW..",
  "RR.......ROOOYYYYYYWWWWW..",
  ".ROO......ROYYYYWWWWWOOO..",
  "...ROOOOORROOOYYWWWWOOOO..",
  ".....ROYYYYYYYYYYYYOOORR..",
  "......RROOOYYOOYYOOOORR...",
  ".........RROOOOORRR.......",
  ".....O.....RORR...........",
  "............R.............",
];
export function drawMeteorPortrait(c: Pens) {
  c.save(); c.translate(4,4); c.rotate(Math.PI/4);
  stamp(c,"red",portraitFlame,-23,-6);
  c.scale(.76,.76); drawRock(c);
  c.restore();
}

export function drawMeteor(c: Pens, spell: FieldSpell, tick: number, sx: number, sy: number) {
  const age = tick - spell.startTick;
  if (age < 0 || age >= duration) return;
  const k = Math.min(sx,sy);
  const x = spell.x*sx, y = spell.y*sy;
  if (age >= delay) {
    drawEffect(c,"meteor",x,y,age-delay,duration-delay,2*radius*k);
    return;
  }
  const drift = 48+.22*spell.y;
  const startX = (spell.x + (spell.x < drift+12 ? drift : -drift))*sx;
  const startY = -2*k;
  const t = age/delay, progress = t*(.65+.35*t);
  const hx = startX+(x-startX)*progress, hy = startY+(y-startY)*progress;
  const angle = Math.atan2(y-startY,x-startX);
  c.save(); c.translate(hx,hy); c.rotate(angle);
  const size = Math.max(k,Math.min(sy,.61));
  const scale = flightScale*size;
  drawEffect(c,"comet",0,0,(age+spell.id*7)%36,36,100*scale);
  // The 24-row stone occupies the old 13-unit head at the new flight scale.
  const texel = 13/rock.length*scale;
  c.scale(texel,texel); drawRock(c);
  c.restore();
}
