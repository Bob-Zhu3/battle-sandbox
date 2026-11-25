import type { Pens } from "./ink.ts";
import { drawEffect } from "./pixel-art/effect-player.ts";
import { SPELLS, type FieldSpell } from "./spells.ts";

const { delay, duration, radius } = SPELLS.meteor;

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
  drawEffect(c,"comet",0,0,(age+spell.id*7)%36,36,100*size);
  // A square white-hot leading edge stays attached to the head during flight.
  c.scale(size,size);
  c.fillStyle="#94413b"; c.fillRect(-5,-6,8,13); c.fillRect(3,-4,3,9);
  c.fillStyle="#fa783c"; c.fillRect(-6,-6,7,10); c.fillRect(0,-3,4,7);
  c.fillStyle="#ffd272"; c.fillRect(-6,-4,7,6);
  c.fillStyle="#fffce8"; c.fillRect(-5,-3,6,4);
  c.restore();
}
