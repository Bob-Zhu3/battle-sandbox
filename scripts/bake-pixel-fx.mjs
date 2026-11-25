// Build from the upstream checkout listed in third_party/pixelfx/README.md.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bellWave, stoneGaze } from "./troop-cues.mjs";

if (!process.argv[2]) throw new Error("Pass the path to the PixelFX checkout.");
const upstream = resolve(process.argv[2]);
const source = file => pathToFileURL(join(upstream, file)).href;
const { loadEffect, edgeFade } = await import(source("tools/lib/fxlib.mjs"));
const { createFrame, clearFrame, createFx, composite, band, hex } = await import(source("src/core/index.js"));
const { encodePNG } = await import(source("tools/lib/png.mjs"));
const folder = fileURLToPath(new URL("../src/pixel-art/", import.meta.url));

// The time window begins at the cue that belongs to the game's event.
// Nothing in the sheet controls hit timing or spawns a second projectile.
const strata = ["#242339","#473748","#684850","#83594f","#9d6653","#ba825c","#d6a37a","#eed4a2"];
const stormPalette=["#171431","#31215e","#493789","#584aa9","#556fd0","#80aae8","#cbe4fa","#fffbe2"];
const boltSequence=(name,seed)=>[name,"lightning/lightning-strike",.76,1.84,27,112,{seed,light:.28,palette:stormPalette}];
const kirinSequence=(name,seed)=>[name,"lightning/chain-lightning",.333,1.22,19,248,{seed,light:.25,
  palette:["#172d46","#283957","#344574","#39679b","#2588a7","#73d5df","#b3eee8","#c7f8f0"],
  sparks:["#fff9d7","#c5faf0","#77d8df","#249eb2"]}];
const original={bellWave:bellWave({band,hex}),stoneGaze:stoneGaze({hex})};
const sequences = [
  ["slash", "melee/sword-slash", .035, .36, 9],
  ["muzzle", "projectiles/muzzle-pistol", .015, .42, 8],
  ["block", "impacts/shield-block", .045, .74, 9],
  ["smash", "impacts/ground-slam", .10, 2.32, 14],
  ["shards", "ice/ice-shatter", .70, 2.13, 12],
  ["snow", "ice/frost-nova", .44, 2.86, 15],
  ["poison", "nature/poison-cloud", .28, 3.83, 16],
  ["rubble", "explosions/dirt-explosion", .075, 2.61, 13],
  ["bomb", "explosions/small-explosion", .07, 3.38, 14],
  ["meteor", "explosions/big-explosion", .13, 3.76, 21, 112, { light:.48 }],
  ["heal", "holy/heal-aoe", .18, 2.59, 12],
  ["zap", "lightning/zap-hit", .035, .73, 10],
  ["fault", "nature/quake", .067, 0.90, 26, 112, { palette:strata }],
  ["faultFloor", "nature/quake", 2.05, 2.63, 8, 112, { palette:strata }],
  ["crater", "fire/meteor", 2.52, 4.40, 11, 112],
  ["fulgurite", "lightning/lightning-strike", 1.86, 2.73, 9, 112, { seed:23, light:.36 }],
  ["comet", "fire/fireball", .08, 1.16, 18, 136, { light:.40 }],
  boltSequence("thunder",23),
  boltSequence("thunderLeft",5),
  boltSequence("thunderRight",72),
  ["gust", "nature/tornado", .20, 1.95, 19, 100, { height:66, light:.46,
    palette:["#293f49","#35545b","#4c7475","#68918a","#8bac9f","#b2ccba","#d5e4c9","#eff4d9"] }],
  ["shower", "water/rain-splash", .08, 2.36, 19, 115, { light:.44 }],
  ["vines", "nature/root-snare", .10, 2.42, 23, 94,
    { palette:["#172c29","#23442e","#33643a","#54863d","#7faf49","#9ac866","#c4e681","#edf3b0"] }],
  ["tendril", "nature/vine-whip", .12, 1.22, 20, 112, { light:.40 }],
  ["glass", "holy/divine-shield", .08, 2.37, 19, 94,
    { light:.28, palette:["#172e4e","#284566","#316683","#428f9d","#61b9c7","#91d5d9","#c3eee7","#f4fff4"] }],
  ["icewall", "ice/ice-spikes", .05, 2.56, 24, 112, { light:.38 }],
  ["fury", "arcane/rune-circle", .15, 2.48, 22, 136,
    { light:.28, palette:["#411f45","#67294b","#93334b","#c3444e","#eb6553","#ff955a","#ffcf7c","#fff1bf"] }],
  ["inlet", "shadow/black-hole", .15, 3.95, 22, 102],
  ["outlet", "arcane/portal", .18, 2.50, 20, 102,
    { palette:["#302949","#57436e","#835894","#b372a0","#e19d9f","#ffcc8d","#fff0bc","#fff7de"] }],
  ["breath", "fire/fire-breath", .03, 1.45, 14],
  kirinSequence("kirinArc",19), kirinSequence("kirinFork",53),
  ["cinder","fire/campfire",0,2.85,20,84,{height:29,light:.20}],
  ["wisp","fire/spirit-flame",0,2.85,20,70,{light:.2}],
  ["venom","nature/toxic-puddle",0,3.8,20,82,{width:9,light:.2,
    palette:["#261b33","#433048","#604059","#825278","#9d729d","#97a44c","#d4dd73","#f3f5b6"]}],
  ["daze","status/stunned",0,.95,16,66,{actor:{w:25,y:-16},light:.16}],
  ["rime","ice/ice-spikes",.08,2.1,18,82,{reach:27,height:25,light:.22}],
  ["sandBreach","impacts/heavy-landing",.035,1.41,18,105,{light:.3,stone:"#976a4c",
    palette:["#3f303a","#604848","#82604d","#ac8059","#cea16c","#e8be86","#ffe3ae"]}],
  ["hexSeal","shadow/hex-sigil",2.34,3.84,17,88,{light:.23,
    palette:["#34253e","#513454","#81486f","#a15989","#c8759e","#e59aba","#ffd1c7","#fff3d5"]}],
  ["infection","nature/acid-splash",.31,1.32,14,74,{light:.25}],
  ["bottleShards","ice/ice-shatter",.76,1.55,13,100,{light:.22,
    palette:["#392a50","#56426d","#76658e","#9487a6","#aaa3bb","#c4cdd5","#dce8df","#fff6cf"]}],
  ["solarRay","arcane/arcane-beam",0,1.12,18,168,{light:.32,
    palette:["#3e2739","#653343","#974746","#c26a3e","#e8953d","#ffd15c","#fff098","#fff7d3"]}],
  ["prismRay","arcane/arcane-beam",0,1.12,18,168,{seed:91,light:.24,
    palette:["#312047","#513563","#584989","#5a60a5","#657dc1","#80b3c6","#b4e7d8","#fff1c5"]}],
  // The ice block is separate from any actor. An empty mask keeps each real troop visible inside it.
  ["iceShell","ice/freeze",.62,2.67,20,94,{light:.21,
    actor:{w:1,h:1,x:0,y:0,mask:{data:[0]},pixels:[0]}}],
  ["bellWave","bellWave",.01,.98,19,96],
  ["stoneGaze","stoneGaze",.01,.98,17,84],
];
// The stock effect chains through three staged targets. Extract its last hop,
// (104,-30) to (150,-19), so each copy can end on a real enemy in the game.
const kirinHop = {width:78,height:51,ox:6,oy:25,span:46};
function isolateKirinHop(rgba,sourceWidth,originX,originY) {
  const {width,height,ox,oy,span}=kirinHop;
  const tile=new Uint8ClampedArray(width*height*4);
  for (let x=0;x<width;x++) {
    const dx=x-ox, slope=Math.round(11*Math.max(0,Math.min(1,dx/span)));
    for (let y=0;y<height;y++) {
      const dy=y-oy, distance=Math.hypot(Math.max(0,-dx,dx-span),dy);
      const opacity=Math.max(0,Math.min(1,(24-distance)/6,x/3));
      if (!opacity) continue;
      const src=((originY-30+slope+dy)*sourceWidth+originX+104+dx)*4, dst=(y*width+x)*4;
      tile.set(rgba.subarray(src,src+4),dst);
      tile[dst+3]*=opacity;
    }
  }
  return tile;
}
// Keep the brightest return stroke for two game ticks, then sample the two weaker strokes.
const thunderTimes=[.7667,.7833,.7833,.80,.83,.86,.89,.93,.99,1.04,1.06,1.08,1.11,1.17,1.23,1.26,1.28,1.31,1.35,1.39,1.44,1.51,1.59,1.66,1.72,1.78,1.84];
// These effects were authored over dark scenes. Put one native shadow pixel on their
// brightly lit edges so the same silhouettes survive on the game's white arena.
const edgeColors = { shower:[62,113,139], glass:[68,121,149], icewall:[47,85,146],
  fury:[153,63,84], outlet:[117,73,112], kirinArc:[50,66,110], kirinFork:[50,66,110],
  rime:[57,109,147], wisp:[44,114,111], cinder:[151,66,53], venom:[100,71,108], daze:[111,72,67] };
function shadeEdges(tile,width,height,tint) {
  if (!tint) return;
  const mask=new Uint8Array(width*height);
  for (let i=0;i<mask.length;i++) mask[i]=tile[i*4+3]>=195 ? 1 : 0;
  for (let y=1;y<height;y++) for (let x=1;x<width;x++) {
    const i=y*width+x,p=i*4;
    if (tile[p+3]>80 || !(mask[i-1] || mask[i-width])) continue;
    if (mask[i-1]+mask[i-width]+mask[i-width-1]<2) continue;
    tile.set(tint,p); tile[p+3]=178;
  }
}
// Displace the strip along one stepped seam in source coordinates. Its slabs, dust
// and late floor frame follow that same seam through both gameplay tremors.
const seam=[[-144,26],[-108,17],[-77,21],[-46,5],[-29,9],[0,0],[22,-11],[40,-7],[61,-22],[86,-17],[116,-32],[144,-29]];
function faultOffset(x) {
  for (let i=1;i<seam.length;i++) {
    const [left,y0]=seam[i-1], [right,y1]=seam[i];
    if (x<=right) return Math.round(y0+(y1-y0)*(x-left)/(right-left));
  }
  return seam.at(-1)[1];
}
const atlasWidth = 1024;
const rows = [];
const metadata = {};
let atlasHeight = 0;
for (const [name, id, beginning, end, count, nativeLimit = 78, options = {}] of sequences) {
  const mod = original[id] ?? (await loadEffect(id)).mod, {meta}=mod;
  const [sourceW, sourceH] = meta.size, [sourceX, sourceY] = meta.origin;
  const kirin = id === "lightning/chain-lightning";
  const [w,h] = kirin ? [kirinHop.width,kirinHop.height] : meta.size;
  // Use the flame base, star orbit, ice cluster, seal center or lens aperture as the game anchor.
  const anchorOffset={cinder:[0,-12],daze:[0,-16],rime:[12,0],hexSeal:[0,-50],solarRay:[15,-24],prismRay:[15,-24]}[name] ?? [0,0];
  const [ox,oy] = kirin ? [kirinHop.ox,kirinHop.oy] : [sourceX+anchorOffset[0],sourceY+anchorOffset[1]];
  const shrink = Math.max(1, Math.ceil(Math.max(w, h) / nativeLimit));
  // Preserve authored vertical bolt detail when the sky is much taller than the target sprite.
  const isBolt = name.startsWith("thunder");
  const verticalStep = isBolt ? 1 : shrink;
  const bent = name === "fault" || name === "faultFloor", pad = bent ? 34 : 0;
  const offsets = bent ? Array.from({length:w},(_,x)=>faultOffset(x-ox)) : null;
  const sw = Math.ceil(w / shrink), sh = Math.ceil((h+2*pad) / verticalStep);
  const frame = createFrame(sourceW,sourceH), rgba = new Uint8ClampedArray(sourceW*sourceH*4);
  const effect = createFx(mod, { x:sourceX, y:sourceY, seed:378, ...options });
  let step = 0, left = sw, top = sh, right = -1, bottom = -1;
  const tiles = [];
  for (let i = 0; i < count; i++) {
    const time = isBolt ? thunderTimes[i] : beginning + (end - beginning) * i / (count - 1);
    const sample = Math.round(60*time);
    while (step < sample) { effect.update(1 / 60); step++; }
    clearFrame(frame);
    // Only the falling drops and crowns belong on the field. The source back layer is a solid pond.
    effect.draw(frame, name === "shower" || name === "venom" || kirin ? "front" : undefined);
    edgeFade(frame);
    composite(frame, rgba, null);
    const pixels=kirin ? isolateKirinHop(rgba,sourceW,sourceX,sourceY) : rgba;
    const tile = new Uint8Array(sw * sh * 4);
    for (let y = 0; y < h; y++) {
      if (name==="cinder" && y>oy) break; // Only the flame and rising sparks, above the logs.
      for (let x = 0; x < w; x++) {
        // Keep distant campfire smoke from shrinking the flames to a dot on a troop.
        if (name==="cinder" && (Math.abs(x-ox)>18 || y<oy-46)) continue;
        const p = (y * w + x) * 4, alpha = pixels[p + 3];
        if (alpha < (nativeLimit > 78 ? 52 : 36)) continue;
        const tx = Math.floor(x / shrink), ty = Math.floor((y+pad+(offsets?.[x] ?? 0))/verticalStep), q = (ty * sw + tx) * 4;
        if (alpha <= tile[q + 3]) continue;
        tile.set(pixels.subarray(p, p + 4), q);
        // The falling rock owns the white core. Its ground burst goes through gold and soot.
        if ((name === "meteor" || name === "crater") && tile[q] > 235 && tile[q+1] > 215 && tile[q+2] > 160) {
          tile[q+1] = Math.min(tile[q+1], 223);
          tile[q+2] = Math.min(tile[q+2], 139);
        }
        left = Math.min(left, tx); right = Math.max(right, tx);
        top = Math.min(top, ty); bottom = Math.max(bottom, ty);
      }
    }
    shadeEdges(tile,sw,sh,edgeColors[name]);
    tiles.push(tile);
  }
  if (right < left) throw new Error("Empty sequence: " + id);
  const width = right - left + 1, height = bottom - top + 1;
  const columns = Math.min(count, Math.floor(atlasWidth / width));
  metadata[name] = { y: atlasHeight, w: width, h: height, ox: Math.round(ox / shrink) - left,
    oy: Math.round((oy+pad) / verticalStep) - top, frames: count, columns, ...(kirin ? {span:kirinHop.span} : {}),
    ...(id==="arcane/arcane-beam" ? {span:Math.round(168/shrink)} : {}),
    ...(name==="iceShell" ? {shellWidth:34/shrink} : {}),
    ...(name==="bellWave" ? {radius:mod.radius} : {}),
    ...(name==="stoneGaze" ? {span:mod.span,halfSpread:mod.halfSpread} : {}),
    ...(verticalStep === shrink ? {} : { pixelAspect:verticalStep/shrink }) };
  for (const [i, tile] of tiles.entries()) {
    rows.push({ tile, sw, left, top, width, height, x: i % columns * width, y: atlasHeight + Math.floor(i / columns) * height });
  }
  atlasHeight += Math.ceil(count / columns) * height;
}
const atlas = new Uint8Array(atlasWidth * atlasHeight * 4);
for (const r of rows) {
  for (let dy = 0; dy < r.height; dy++) {
    const p = ((r.top + dy) * r.sw + r.left) * 4;
    atlas.set(r.tile.subarray(p, p + r.width * 4), ((r.y + dy) * atlasWidth + r.x) * 4);
  }
}
await mkdir(folder, { recursive: true });
await writeFile(join(folder, "effects.png"), encodePNG(atlasWidth, atlasHeight, atlas));
await writeFile(join(folder, "effects.ts"), "// Generated by scripts/bake-pixel-fx.mjs\nexport const effects = {\n"
  + Object.entries(metadata).map(([name, entry]) => "  " + name + ": " + JSON.stringify(entry) + ",").join("\n")
  + "\n} as const;\n");
console.log(sequences.length + " sequences, " + atlasWidth + " × " + atlasHeight);
