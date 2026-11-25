import { ARMIES, BASE_HP, type Base } from "./battlefield.ts";
import { segment, stamp } from "./pixel-art/stamps.ts";

const rampart = [
  ".KKKK..KKKK.......KKKK..KKKK.",
  ".KIIK..KIIK.......KIIK..KIIK.",
  ".KISK..KISK.......KISK..KISK.",
  ".KISKKKKISKKKKKKKKKISKKKKISK.",
  ".KISSSSSSSKSSSSSSSKISSSSSSmK.",
  ".KIIIIIIIISIIIIIIISIIIIIIImK.",
  "..KmmmmmmSSmmmmmmmSSmmmmmmK..",
  "..KISSSSSSmSSSSSSSmSSSSSmmK..",
  "..KISSSSSmmSSSSSSmmSSSSSmmK..",
  "..KIScccdSSSSIISSSSSSmSSmmK..",
  "..KIScccdSSSmmmmSSSSSmSSmmK..",
  "..KISchcdSSmKKKKmSSSSSSSmmK..",
  "..KIScccdSmKKbbKKmSSSSSSmmK..",
  "..KIScdcdSKKbyybKKSSmSSSmmK..",
  "..KISScdSSKbyyyybKSSmSSSmmK..",
  "..KISSSSSSKbybyybKSSSSSSmmK..",
  ".KKmmmmmmmKbybyybKmmmmmmmmKK.",
  ".KSSSSSSSmKbbbybbKSSSSSSmmmK.",
  ".KmmmmmmmmKKKKKKKKmmmmmmmmmK.",
  "..KKKKKKKKKKKKKKKKKKKKKKKKK..",
];
const litRampart=rampart.map(row=>row.replace(/[mSI]/g,p=>p==="m"?"S":"W"));
const rubble=["....mmS..........m......","..mSSSm..mSSm...Sm...Sm.","..mSmmK.mSSSSm.mSmK.SSm.","..KKKKK.KmmmmK.KKKK.KmK.","........KKKKKK.........."];

export function drawKeep(c: CanvasRenderingContext2D, base: Base, x: number, y: number, scale: number, tick: number) {
  const dye=ARMIES[base.team];
  c.save(); c.translate(x,y); c.scale(scale*1.55,scale*1.55); c.imageSmoothingEnabled=false;
  c.fillStyle="#39394e25"; c.fillRect(-16,3,32,4); c.fillRect(-13,7,25,2);
  if (base.hp<=0) { stamp(c,base.team,rubble,-12,0); c.restore(); return; }
  const flash=base.lastHitTick!==null && tick>=base.lastHitTick && tick-base.lastHitTick<4;
  stamp(c,base.team,flash ? litRampart : rampart,-14,-14);
  // The flag folds by one pixel at a time. The lookout points and recoils on the base's own shot tick.
  const fold=Math.floor((tick+base.id*7)/9)%4, tip=fold<2?0:1;
  segment(c,7,-13,7,-24,"#38415a",1);
  c.fillStyle=dye.hem; c.fillRect(8,-24,6,5); c.fillRect(14,-24+tip,3,3);
  c.fillStyle=dye.coat; c.fillRect(8,-24,6,3); c.fillStyle=dye.light; c.fillRect(8,-24,4,1);
  const side=base.aimX<0?-1:1, watching=base.targetId!=null, height=watching?-16:-14;
  c.save(); c.scale(side,1);
  c.fillStyle="#242339"; c.fillRect(-4,height-4,6,4); c.fillRect(-3,height,6,2);
  c.fillStyle=dye.coat; c.fillRect(-4,height-4,5,2); c.fillStyle="#ffcf93"; c.fillRect(-2,height-1,4,2);
  c.fillStyle="#242339"; c.fillRect(1,height-1,1,1);
  const recoil=Math.max(0,Math.min(1,1-(tick-(base.lastShotTick??-1000))/9));
  const dx=(watching?8:5)-2*recoil, dy=Math.round(base.aimY*3);
  segment(c,-1,height+2,dx,height+2+dy,"#38415a",2);
  segment(c,dx-2,height-1+dy,dx,height+2+dy,"#bd7746");
  segment(c,dx,height+2+dy,dx-2,height+5+dy,"#bd7746");
  c.restore();
  if (base.hp<BASE_HP/2) {segment(c,10,-5,7,-2,"#516077");segment(c,7,-2,9,0,"#516077");segment(c,9,0,7,3,"#516077");}
  c.fillStyle="#38415a"; c.fillRect(-14,9,28,3); c.fillStyle=dye.light;
  c.fillRect(-13,10,Math.round(26*base.hp/BASE_HP),1);
  c.restore();
}
