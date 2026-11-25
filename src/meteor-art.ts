import { drawEffect } from "./pixel-art/effect-player.ts";
import { line, oval, type Pens } from "./ink.ts";
import { SPELLS, type FieldSpell } from "./spells.ts";

const { delay, duration, radius } = SPELLS.meteor;
const tau = Math.PI * 2;
function progress(age: number) {
  const t = Math.max(0, Math.min(1, age / delay));
  return t * (.65 + .35 * t);
}

// Every spark has a birth tick. Repainting a snapshot reconstructs the same wake.
function sample(seed: number, index: number) {
  let n = Math.imul(seed ^ (index * 374761393), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function tongue(c: Pens, x: number, width: number, length: number, bend: number, color: string) {
  c.beginPath(); c.moveTo(x - width, 1);
  c.bezierCurveTo(x-width*1.45, -length*.35, x+bend-width*.4, -length*.66, x+bend, -length);
  c.bezierCurveTo(x+bend+width*.35, -length*.72, x+width*1.5, -length*.37, x+width, -1);
  c.quadraticCurveTo(x, 6, x-width, 1);
  c.fillStyle = color; c.fill();
}

function drawWake(c: Pens, age: number, distance: number, seed: number) {
  // Smoke and cinders stay near the point the stone passed, drift out, and cool.
  const last = Math.min(Math.floor(age), delay-1);
  for (let birth = Math.max(0, Math.ceil(age-20)); birth <= last; birth++) {
    const time = age-birth, noise = sample(seed,birth*4), side = sample(seed,birth*4+1)*2-1;
    const life = time / (10+10*noise);
    if (life >= 1) continue;
    const x = side*(2+time*.85) + Math.sin(time*.32 + noise*tau)*life*3;
    const y = -distance*(1-progress(birth)) - time*(.4+noise*.7);
    if (birth % 3 === 0 && time > 4) {
      c.globalAlpha = .34*(1-life)*Math.min(1,(time-4)*.35);
      const size = 3+life*6+noise*2;
      oval(c,x,y,size,size*.74,"#796c61");
      oval(c,x+side*size*.6,y-1,size*.68,size*.66,"#ac8a70");
    }
    // Hot gas starts as a broad cuff, breaks into lobes and cools before the soot does.
    const flameLife = time/(6+noise*5);
    if (flameLife < 1) {
      const width = (1-flameLife)*5 + 2.6;
      const curl = x + Math.sin(time*.55 + birth*.83) * (1+flameLife*2.2);
      c.globalAlpha = .82*(1-flameLife*flameLife);
      oval(c,curl,y,width*(1.2+noise*.3),width*1.5,flameLife>.48 ? "#de7440" : "#f59a43");
      c.globalAlpha *= .84;
      oval(c,curl-side*1.4,y+1,width*.7,width*1.2,flameLife>.48 ? "#ffa749" : "#ffcc64");
    }
    c.globalAlpha = Math.min(1,(1-life)*2)*.94;
    const spark = (1-life)*1.35+.65, fly = x+side*(3+time*.45);
    line(c,fly,y,fly-side*spark*1.1,y+spark*(2.2+noise),life < .52 ? "#ffcc72" : "#b75b35",spark);
  }
  c.globalAlpha = 1;
}

function drawHead(c: Pens, age: number, distance: number, seed: number) {
  const angle = age*.42 + sample(seed,1)*tau;
  const length = Math.min(72, Math.max(23, distance*(progress(age)-progress(age-9)) + 12));
  const heat = c.createRadialGradient(0,-2,2,0,-2,22);
  heat.addColorStop(0,"#ffe28edc"); heat.addColorStop(.5,"#ffad506e"); heat.addColorStop(1,"#e97c3600");
  c.fillStyle = heat; c.fillRect(-22,-24,44,44);
  tongue(c,-2.5,5.9,length*(.79+.12*Math.sin(angle)), -4+Math.sin(angle*.63)*5,"#d36d3de0");
  tongue(c,3,4.8,length*(.66+.16*Math.cos(angle*.89)), 3+Math.cos(angle*.78)*5,"#ea8442");
  tongue(c,-.7,5.8,length*(.59+.12*Math.sin(angle+1)), Math.sin(angle*.9)*4,"#ffb44f");
  tongue(c,.8,4.2,length*(.40+.1*Math.cos(angle)), 2+Math.sin(angle*1.1)*3,"#ffdc79");
  tongue(c,-1.4,2.8,length*(.26+.08*Math.sin(angle)), -1+Math.cos(angle*1.2)*2,"#fff3b2");
  const curl = Math.sin(angle)*1.6;
  c.beginPath(); c.moveTo(-7.7,-6); c.bezierCurveTo(-8.6,2,-5,7.4,1,7.8);
  c.bezierCurveTo(6,7.4,9.3,2,7.2,-6); c.quadraticCurveTo(1,-11,-7.7,-6);
  c.fillStyle="#ec9044"; c.fill();
  c.beginPath(); c.moveTo(-6.9,-6); c.bezierCurveTo(-7.3,-1,-3.8,6.8,1.1,6.3);
  c.bezierCurveTo(6.4,5.9,7.6,1,6.1,-6.6); c.quadraticCurveTo(2+curl,-10,2.4,-14);
  c.quadraticCurveTo(.1,-12,-.5,-7.7); c.quadraticCurveTo(-3.7,-10.8,-4.2+curl,-15); c.closePath();
  c.fillStyle="#ffe693"; c.fill();
  oval(c,-.5+curl*.3,.2,4.3,4.6,"#fffce8");
  c.beginPath(); c.moveTo(-6.8,2.4); c.quadraticCurveTo(-3.1,9,3.6,6.6);
  c.strokeStyle="#9d5b388e"; c.lineWidth=1.15; c.stroke();
}

function strike(c: Pens, after: number, sx: number, sy: number, size: number, seed: number) {
  const life = after/(duration-delay);
  const wave = 1-(1-Math.min(1,(after+1)/16))**2;
  c.save(); c.scale(sx,sy);
  c.globalAlpha = (1-life)*.67;
  c.strokeStyle = "#fff0b0"; c.lineWidth = 4.2*(1-life)+.4; c.beginPath();
  c.arc(0,0,radius*wave,0,tau); c.stroke();
  c.restore();
  c.save(); c.scale(size,size);
  if (after < 7) {
    const flash = c.createRadialGradient(0,0,0,0,0,12+after*3);
    flash.addColorStop(0,"#fff8c7"); flash.addColorStop(.33,"#ffda74da"); flash.addColorStop(1,"#f5994600");
    c.globalAlpha = 1-after/7; c.fillStyle = flash; c.fillRect(-34,-34,68,68);
  }
  for (let i=0; i<14; i++) {
    const a = (i+sample(seed,70+i)*.55)*tau/14, speed = .85+sample(seed,99+i)*1.4;
    const vx = Math.cos(a)*speed, vy = Math.sin(a)*speed*.62, t = after+1;
    const x = vx*t, y = vy*t-t*(1.9+speed*.32)+.105*t*t;
    c.globalAlpha = (1-life)**1.2;
    if (i%3 === 0) oval(c,vx*t,vy*t-t*.32-1,2+t*.19,1.5+t*.13,"#aa856889");
    line(c,x-vx*1.5,y-(vy-1.9+.21*t)*1.5,x,y,after<9 ? "#ffc55b" : "#956745",2.3-.9*life);
  }
  c.restore();
}

export function drawMeteor(c: Pens, spell: FieldSpell, tick: number, sx: number, sy: number) {
  const age = tick-spell.startTick;
  if (age < 0 || age >= duration) return;
  const scale = Math.min(sx,sy), size = 1.32*Math.max(scale, Math.min(sy,.61));
  const drift = 48+.22*spell.y;
  const fromX = (spell.x < drift+12 ? drift : -drift)*sx, fromY = -spell.y*sy-2*size;
  const distance = Math.hypot(fromX,fromY)/size;
  const seed = spell.id ^ Math.imul(spell.startTick+1,2654435761);
  c.save(); c.translate(spell.x*sx,spell.y*sy); c.lineCap = "round";
  c.save(); c.rotate(Math.atan2(fromX,-fromY)); c.scale(size,size);
  drawWake(c,age,distance,seed);
  if (age < delay) {
    c.translate(0,-distance*(1-progress(age)));
    drawHead(c,age,distance,seed);
  }
  c.restore();
  if (age >= delay && !drawEffect(c,"meteor",0,0,age-delay,duration-delay,2*SPELLS.meteor.radius*scale)) {
    strike(c,age-delay,sx,sy,size,seed);
  }
  c.restore();
}
