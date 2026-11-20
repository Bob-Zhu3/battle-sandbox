import { ARMIES, BASE_HP, type Base } from "./battlefield.ts";

const wall = new Path2D("M-19 7 L-19 -13 L-22 -14 L-22 -24 L-16 -24 L-16 -20 L-11 -20 L-11 -25 L-5 -25 L-5 -16 L5 -16 L5 -25 L11 -25 L11 -20 L16 -20 L16 -24 L22 -24 L22 -14 L19 -13 L19 7 Q0 14 -19 7Z");
const gate = new Path2D("M-5 10 L-5 2 Q-5 -6 0 -6 Q5 -6 5 2 L5 10Z");
const banner = new Path2D("M-12 -15 L-6 -15 L-6 -2 L-9 1 L-12 -2Z");

export function drawKeep(c: CanvasRenderingContext2D, base: Base, x: number, y: number, scale: number, tick: number) {
  const paint = ARMIES[base.team];
  c.save(); c.translate(x,y); c.scale(scale,scale); c.lineJoin = "round";
  c.fillStyle = "#42513b38"; c.beginPath(); c.ellipse(1,9,26,7,0,0,Math.PI*2); c.fill();
  if (base.hp <= 0) {
    c.fillStyle="#969b84"; c.strokeStyle="#455145"; c.lineWidth=1.4;
    for (const [dx,dy] of [[-14,2],[-7,-2],[3,1],[12,3]]) { c.fillRect(dx,dy,8,5); c.strokeRect(dx,dy,8,5); }
  } else {
    c.strokeStyle="#2b3831"; c.lineWidth=2;
    c.fillStyle=base.lastHitTick !== null && tick-base.lastHitTick<4 ? "#fff2cb" : "#cecbb1"; c.fill(wall); c.stroke(wall);
    c.fillStyle="#a6ab92"; c.fillRect(13,-13,5,18);
    c.fillStyle="#334038"; c.fill(gate);
    c.fillStyle=paint.coat; c.fill(banner); c.stroke(banner);
    c.beginPath(); c.moveTo(9,-22); c.lineTo(9,-38); c.stroke();
    c.beginPath(); c.moveTo(9,-37); c.lineTo(23,-34); c.lineTo(18,-30); c.lineTo(9,-31); c.closePath();
    c.fillStyle=paint.coat; c.fill(); c.stroke();
    const watching=base.targetId != null;
    const recoil=Math.max(0,1-(tick-(base.lastShotTick??-1000))/9);
    c.save(); c.translate(0,-18); c.scale(base.aimX<0?-1:1,1);
    c.fillStyle="#fff0ca"; c.beginPath(); c.arc(0,watching?-6:-3,3.2,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle=paint.coat;c.fillRect(-4,watching?-10:-7,7,3);
    c.rotate(Math.atan2(base.aimY,Math.abs(base.aimX))*.65);
    c.translate(-recoil*3,0);c.strokeStyle="#344139";c.lineCap="round";c.lineWidth=3.8;
    c.beginPath();c.moveTo(-3,-1);c.lineTo(watching?11:7,-1);c.stroke();
    c.strokeStyle="#d7ab64";c.lineWidth=2;c.beginPath();c.moveTo(5,-5);c.quadraticCurveTo(10,-1,5,3);c.stroke();
    c.restore();
    if (base.hp < BASE_HP/2) {
      c.beginPath(); c.moveTo(15,-11); c.lineTo(10,-6); c.lineTo(12,-2); c.lineTo(8,3); c.lineWidth=1.1; c.stroke();
    }
    c.fillStyle="#354034"; c.fillRect(-21,14,42,5);
    c.fillStyle=paint.light; c.fillRect(-20,15,40*base.hp/BASE_HP,3);
  }
  c.restore();
}
