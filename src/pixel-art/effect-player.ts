import { effects } from "./effects.ts";

export type EffectName = keyof typeof effects;
const sheet = new Image();
sheet.src = new URL("./effects.png", import.meta.url).href;

export function whenEffectsLoad(paint: () => void) {
  if (!sheet.complete) sheet.addEventListener("load", paint, { once: true });
}

// The anchor is the effect author's ground/impact point, including off-center effects.
export function drawEffect(c: CanvasRenderingContext2D, name: EffectName, x: number, y: number,
  age: number, duration: number, width: number, facing = 1) {
  if (age < 0 || age >= duration || !sheet.complete || !sheet.naturalWidth) return false;
  const row = effects[name];
  const frame = Math.floor(age / duration * row.frames);
  const scale = width / row.w;
  c.save();
  c.translate(x, y);
  c.scale(facing * scale, scale);
  c.imageSmoothingEnabled = false;
  c.drawImage(sheet, frame % row.columns * row.w, row.y + Math.floor(frame / row.columns) * row.h,
    row.w, row.h, -row.ox, -row.oy, row.w, row.h);
  c.restore();
  return true;
}

// Stretch only the middle of the PixelFX hop. The hot knots and sparks at
// either end keep their native size, including on short or nearly vertical jumps.
export function drawKirinHop(c: CanvasRenderingContext2D, x: number, y: number, toX: number, toY: number,
  progress: number, pitch: number, alternate: boolean) {
  if (!sheet.complete || !sheet.naturalWidth) return;
  const row=alternate ? effects.kirinFork : effects.kirinArc;
  const frame=Math.min(row.frames-1,Math.floor(progress*row.frames));
  const tx=frame%row.columns*row.w, ty=row.y+Math.floor(frame/row.columns)*row.h;
  const dx=toX-x, dy=toY-y, length=Math.hypot(dx,dy);
  c.save(); c.translate(x,y); c.rotate(Math.atan2(dy,dx)); c.imageSmoothingEnabled=false;
  const cap=7, end=row.ox+row.span-cap;
  if (length<=2*cap*pitch) {
    // Touching footprints can leave room only for the contact spark.
    const gap=length-cap*pitch;
    if (gap>0) c.drawImage(sheet,tx+row.ox,ty,end-row.ox,row.h,0,-row.oy*pitch,gap,row.h*pitch);
  } else {
    const first=row.ox+cap;
    c.drawImage(sheet,tx,ty,first,row.h,-row.ox*pitch,-row.oy*pitch,first*pitch,row.h*pitch);
    c.drawImage(sheet,tx+first,ty,end-first,row.h,cap*pitch,-row.oy*pitch,length-2*cap*pitch,row.h*pitch);
  }
  c.drawImage(sheet,tx+end,ty,row.w-end,row.h,length-cap*pitch,-row.oy*pitch,(row.w-end)*pitch,row.h*pitch);
  c.restore();
}

// The impact anchor stays fixed when the sheet crops its quieter floor frames.
export function drawFloorFrame(c: CanvasRenderingContext2D, name: "faultFloor" | "crater" | "fulgurite",
  x: number, y: number, age: number, duration: number, width: number) {
  if (age < 0 || age >= duration || !sheet.complete || !sheet.naturalWidth) return;
  const row = effects[name];
  const original = effects[name === "faultFloor" ? "fault" : name === "crater" ? "meteor" : "thunder"];
  const size = width / original.w;
  const frame = Math.min(row.frames-1,Math.floor(age/duration*row.frames));
  // Airborne debris from the cast belongs in the impact pass, never in a floor mark.
  const top = name === "faultFloor" ? 0 : Math.max(0,row.oy-(name === "crater" ? 8 : 6));
  c.imageSmoothingEnabled = false;
  c.drawImage(sheet,frame%row.columns*row.w,row.y+Math.floor(frame/row.columns)*row.h+top,
    row.w,row.h-top,x-row.ox*size,y+(top-row.oy)*size,row.w*size,(row.h-top)*size);
}

// Only the sky portion changes length with the strike height. The contact flash
// and scorched floor keep the same pixel size as the troops standing in them.
export function drawSkyStrike(c: CanvasRenderingContext2D, x: number, groundY: number, age: number,
  duration: number, width: number, facing: number, variant: number) {
  if (age < 0 || age >= duration || !sheet.complete || !sheet.naturalWidth) return;
  const row=variant===1 ? effects.thunderLeft : variant===2 ? effects.thunderRight : effects.thunder;
  const size=width/row.w, f=Math.floor(age/duration*row.frames);
  const tx=f%row.columns*row.w, ty=row.y+Math.floor(f/row.columns)*row.h;
  const pitchY=size*row.pixelAspect;
  const split=row.oy-Math.round(12/row.pixelAspect), seam=Math.max(0,groundY-12*size);
  c.save(); c.translate(x,0); c.scale(facing,1); c.imageSmoothingEnabled=false;
  // Crop the authored sky on short strikes. Extend its upper portion on deep fields.
  const skyRows = Math.min(split,Math.max(1,Math.round(seam/pitchY)));
  if (seam>0) c.drawImage(sheet,tx,ty+split-skyRows,row.w,skyRows,-row.ox*size,0,width,seam);
  c.drawImage(sheet,tx,ty+split,row.w,row.h-split,-row.ox*size,groundY-12*size,width,(row.h-split)*pitchY);
  c.restore();
}
