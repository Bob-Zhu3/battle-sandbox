import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { createGameServer } from "../server/http.ts";
import { ARENA, ARMIES, TEAMS } from "../src/battlefield.ts";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";
import { FACE, INK } from "../src/ink.ts";
import { checkPausedPlacement } from "./check-paused-placement.mjs";

const { values } = parseArgs({ options: { channel: { type: "string" }, output: { type: "string" } } });
const browser = await chromium.launch({ headless: true, channel: values.channel ?? (existsSync(chromium.executablePath()) ? undefined : "chrome") });
const errors = [];
if (values.output) await mkdir(values.output, { recursive: true });

async function open(url, width = 1000, height = 600, pauseClock = false) {
  const page = await browser.newPage({ viewport: { width, height } });
  if (pauseClock) {
    const time = new Date("2026-01-01T12:00:00Z");
    await page.clock.install({time});
    await page.clock.pauseAt(new Date(time.getTime()+1000));
  }
  const frames = [], joins = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("websocket", socket => socket.on("framereceived", ({payload}) => {
    const event = JSON.parse(String(payload));
    if (event.type === "snapshot") frames.push(event);
    if (event.type === "joined") joins.push(event);
  }));
  await page.goto(url);
  const rect = await page.locator("#arena").boundingBox();
  const point = (x,y) => [rect.x + x * rect.width / ARENA.width, rect.y + y * rect.height / ARENA.height];
  async function waitForUnits(count) {
    const until = Date.now() + 5000;
    while ((frames.at(-1)?.world.units.length ?? 0) < count && Date.now() < until) await delay(10);
    assert.equal(frames.at(-1)?.world.units.length, count);
  }
  return { page, frames, joins, point, waitForUnits };
}
async function chooseCard(page, shelf, name) {
  await page.getByRole("tab",{name:shelf,exact:true}).click();
  await page.getByRole("tabpanel").getByRole("button",{name,exact:true}).click();
}
async function picture(page, name) {
  if (values.output) await page.screenshot({ path: join(values.output, name + ".png") });
}

async function phoenixDuringDeployment(url) {
  const {page, point, waitForUnits} = await open(url + "/room", 390, 700);
  try {
    await page.waitForFunction(() => document.querySelector(".game").dataset.team === "red");
    await chooseCard(page, "Mythical", "Phoenix");
    await page.mouse.click(...point(326, 187));
    await waitForUnits(1);
    await page.waitForFunction(() => document.querySelector("#red-count").textContent === "1");
    const colors = [INK, ARMIES.red.coat, FACE].map(hex =>
      [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)));
    async function checkPaint(canvas, field = false) {
      const paint = await canvas.evaluate((el, {colors, field}) => {
        const area = field ? [.28, .43, .12, .14] : [0, 0, 1, 1];
        const [x, y, w, h] = area.map((v, i) => Math.round(v * (i % 2 ? el.height : el.width)));
        const pixels = el.getContext("2d").getImageData(x, y, w, h).data;
        // At phone size the ink stroke can cover only part of a pixel.
        const found = colors.map(color => {
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] >= 110 && color.every((v, k) => Math.abs(pixels[i + k] - v) <= 10)) return true;
          }
          return false;
        });
        const clearFrame = field || pixels.every((alpha, i) => {
          if (i % 4 !== 3 || alpha < 32) return true;
          const col = (i >> 2) % w, row = Math.floor((i >> 2) / w);
          return col > 0 && col < w - 1 && row > 0 && row < h - 1;
        });
        return {found, clearFrame};
      }, {colors, field});
      assert.deepEqual(paint.found, [true, true, true], "The Phoenix has its ink outline, team feathers and pale face");
      assert.ok(paint.clearFrame, "The full wing and forked tail fit inside the portrait");
    }
    await checkPaint(page.locator("#brush-phoenix canvas"));
    await checkPaint(page.locator("#arena"), true);
    assert.equal(Number(await page.locator("#tick").textContent()), 0);
    console.log("Phoenix: the complete roster portrait and deployed bird are visible on a phone at tick zero.");
  } finally { await page.context().close(); }
}

async function withField(check) {
  const {http,closeRoom} = createGameServer();
  http.listen(0,"127.0.0.1"); await once(http,"listening");
  try { await check("http://127.0.0.1:" + http.address().port); }
  finally { closeRoom(); await new Promise(resolve => http.close(resolve)); }
}

async function pausePlayground(url) {
  const {page, point} = await open(url, 960, 540, true);
  try {
    const tick = () => page.locator("#tick").textContent();
    const pixels = () => page.locator("#arena").evaluate(c => c.toDataURL());
    await page.getByRole("button", {name:"Archer",exact:true}).click({force:true});
    await page.mouse.click(...point(330,155));
    await page.getByRole("button", {name:"Blue army"}).click({force:true});
    await page.getByRole("button", {name:"Warrior",exact:true}).click({force:true});
    await page.mouse.click(...point(438,155));
    await page.clock.runFor(84);
    const pose = await pixels();
    await page.getByRole("button", {name:"Pause playground"}).click({force:true});
    const frozen = await tick();
    await page.clock.runFor(900);
    assert.equal(await pixels(), pose);
    assert.equal(await tick(), frozen);
    await page.mouse.click(...point(470,200));
    assert.equal(await page.locator("#blue-count").textContent(), "2");
    const newPose = await pixels();
    assert.notEqual(newPose, pose);
    await page.clock.runFor(500);
    assert.equal(await pixels(), newPose);
    await page.locator("#arena").focus();
    await page.keyboard.press("Space");
    await page.clock.runFor(150);
    const resumed = Number(await tick());
    assert.ok(resumed > Number(frozen) && resumed <= Number(frozen) + 10);
    assert.notEqual(await pixels(), newPose);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), "rgb(255, 255, 255)");
    await page.goto(url + "/?demo=crowd");
    await page.getByRole("button", {name: "Resume playground"}).waitFor();
    for (const side of ["red", "blue"]) assert.equal(await page.locator("#" + side + "-count").textContent(), "100");
    await page.getByRole("button", {name: "Resume playground"}).click({force:true});
    await page.clock.runFor(200);
    await page.getByRole("button", {name: "Pause playground"}).click({force:true});
    const crowdPose = await pixels();
    await page.clock.runFor(500);
    assert.equal(await pixels(), crowdPose);
    assert.ok(Number(await tick()) > 0);
    await page.goto(url+"/room");
    await page.locator("#play").waitFor();
    assert.ok(await page.locator("#playground-pause").isHidden());
    console.log("Playground: pause holds the exact painted frame, accepts troops and resumes without catching up.");
  } finally { await page.context().close(); }
}

async function arrowFlash(url) {
  const {page,point}=await open(url,960,540,true);
  try {
    const pick=name=>page.getByRole("button",{name,exact:true}).click({force:true});
    await pick("Archer"); await page.mouse.click(...point(390,180));
    await pick("Blue army"); await pick("Warrior"); await page.mouse.click(...point(502,180));
    const frames=[];
    for(let i=0;i<33;i++) {
      await page.clock.runFor(17);
      frames.push(await page.locator("#arena").evaluate(canvas=>{
        const c=canvas.getContext("2d");
        function white(left,width) {
          const pixels=c.getImageData(left,240,width,45).data;
          let count=0;
          for(let j=0;j<pixels.length;j+=4) {
            if(pixels[j]===255 && pixels[j+1]===255 && pixels[j+2]===255 && pixels[j+3]>245) count++;
          }
          return count;
        }
        return [white(360,60),white(435,100)];
      }));
    }
    assert.ok(frames.every(([archer])=>archer<8),"The untouched Archer keeps its colors");
    assert.ok(frames.slice(0,9).every(([,target])=>target<8),"The arrow is still in flight");
    assert.ok(frames.some(([,target])=>target>150),"The Warrior's whole silhouette turns white");
    assert.ok(frames.slice(-4).every(([,target])=>target<8),"The Warrior regains its colors");
    assert.equal(await page.locator("#blue-hp").textContent(),String(defs.warrior.maxHp-8));
    console.log("Arrow impact: the struck Warrior flashes and recovers its colors while the Archer stays red.");
  } finally { await page.context().close(); }
}

async function paletteAndMeteor(url) {
  for(const [width,height,targetX] of [[960,540,880],[390,700,48]]){
    const {page,point}=await open(url,width,height,true);
    try {
      const bar=page.locator("#brush-tool"), panel=page.getByRole("tabpanel");
      const pick=(scope,name)=>scope.getByRole("button",{name,exact:true}).click({force:true});
      const tab=name=>bar.getByRole("tab",{name,exact:true});
      assert.deepEqual(await bar.getByRole("tab").allTextContents(),["People","Machines","Towers","Mythical","Spells"]);
      assert.equal(await panel.getByRole("button").count(),14);
      assert.equal(await page.getByRole("button",{name:"Roster",exact:true}).count(),0);
      const track=bar.locator("#palette-track");
      const position=()=>track.evaluate(el=>el.scrollLeft);
      await pick(bar,"Scroll troops right"); assert.equal(await position(),0);
      await page.clock.runFor(32);const first=await position();assert.ok(first>0);
      await page.clock.runFor(32);assert.ok(await position()>first);
      await pick(bar,"Scroll troops left");await page.clock.runFor(420);assert.equal(await position(),0);
      await track.dispatchEvent("wheel",{deltaY:45});await track.dispatchEvent("wheel",{deltaY:65});
      await page.clock.runFor(32);assert.ok(await position()>0 && await position()<109);
      await page.clock.runFor(420);assert.ok(Math.abs(await position()-110)<=1);
      await track.dispatchEvent("wheel",{deltaY:100});await page.clock.runFor(32);const forward=await position();
      await track.dispatchEvent("wheel",{deltaY:-55});await page.clock.runFor(32);const reversed=await position();
      assert.ok(reversed<forward);
      await tab("Machines").click({force:true});await page.clock.runFor(420);await tab("People").click({force:true});
      assert.ok(Math.abs(await position()-reversed)<=1);
      await page.emulateMedia({reducedMotion:"reduce"});
      await pick(bar,"Scroll troops left");assert.equal(await position(),0);
      await track.dispatchEvent("wheel",{deltaY:87});assert.ok(Math.abs(await position()-87)<=1);
      await page.emulateMedia({reducedMotion:"no-preference"});
      await page.keyboard.press("2"); assert.equal(await bar.locator("button[aria-pressed=true]").getAttribute("aria-label"),"Archer");
      await tab("Mythical").click({force:true});await pick(panel,"Phoenix");
      await page.reload();await page.locator("#brush-phoenix").waitFor();
      assert.equal(await tab("Mythical").getAttribute("aria-selected"),"true");
      assert.equal(await page.locator("#brush-phoenix").getAttribute("aria-pressed"),"true");
      await tab("Spells").click({force:true}); assert.ok(await tab("Mythical").evaluate(el=>el.hasAttribute("data-armed")));
      await tab("People").focus(); await page.keyboard.press("Home"); await page.keyboard.press("ArrowRight");
      assert.equal(await tab("Machines").getAttribute("aria-selected"),"true");
      await pick(page,"Blue army");await tab("Towers").click({force:true});await pick(panel,"Watchpost");
      const groundY=224;
      await page.mouse.click(...point(targetX,groundY));await page.clock.runFor(32);
      await pick(page,"Red army");await tab("Spells").click({force:true});await pick(panel,"Meteor");
      assert.equal(await panel.isVisible(),true);
      await page.mouse.click(...point(targetX,groundY));
      // Locate the white-hot core on the transparent battlefield layer.
      async function core() {
        return page.locator("#arena").evaluate(canvas=>{
          const pixels=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;
          let x=0,y=0,n=0;
          for(let i=0;i<pixels.length;i+=4) {
            if(pixels[i+3]<190 || Math.abs(pixels[i]-255)>4 || Math.abs(pixels[i+1]-252)>5 || Math.abs(pixels[i+2]-232)>7) continue;
            const px=i/4;x+=px%canvas.width;y+=Math.floor(px/canvas.width);n++;
          }
          if (!n) return null;
          x/=n; y/=n;
          // Compare the flame relative to its moving head, excluding the bright core itself.
          const wake=Array(14).fill(0);
          for(let dy=9;dy<79;dy++){
            const row=Math.round(y)-dy; if(row<0) break;
            for(let col=Math.max(0,Math.round(x)-45);col<Math.min(canvas.width,Math.round(x)+46);col++){
              const i=(row*canvas.width+col)*4, r=pixels[i], g=pixels[i+1], b=pixels[i+2];
              if(pixels[i+3]>110 && r>178 && r>g*1.15 && g>b*1.4) wake[Math.floor((dy-9)/5)]++;
            }
          }
          return {x:x/canvas.width*960,y:y/canvas.height*360,wake};
        });
      }
      await page.clock.runFor(48);const entry=await core();
      assert.ok(entry && entry.y<18 && entry.x>0 && entry.x<960,"The Meteor enters through the top edge");
      await page.clock.runFor(350);const middle=await core();
      assert.ok(middle && middle.y>groundY*.28 && middle.y<groundY*.56);
      await page.clock.runFor(100);const later=await core();
      if(width===960) {
        const difference=later.wake.reduce((total,pixels,i)=>total+Math.abs(pixels-middle.wake[i]),0);
        assert.ok(difference>middle.wake.reduce((a,b)=>a+b,0)*.10,"The wake changes shape after aligning the two moving cores");
        assert.deepEqual(await core(),later,"The same frozen frame holds the same cinders");
      }
      await page.clock.runFor(266);const near=await core();
      assert.ok(near && Math.abs(near.x-targetX)<13 && near.y>groundY*.86 && near.y<groundY);
      assert.equal(await page.locator("#blue-hp").textContent(),String(defs.post.maxHp));
      await page.clock.runFor(130);
      assert.equal(await page.locator("#blue-hp").textContent(),String(defs.post.maxHp-17));
      assert.equal(await core(),null);
    } finally {await page.context().close();}
  }
  console.log("Roster glides across frames, reverses on input, remembers each category and honors reduced motion on desktop and phone. Top-edge Meteor passes.");
}

async function touchAndSound(url) {
  const context = await browser.newContext({viewport:{width:390,height:700},isMobile:true,hasTouch:true});
  const page = await context.newPage();
  try {
    // Read the real game mix just before the speaker, including its mute envelope.
    await page.addInitScript(() => {
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function(...args) {
        const result = connect.apply(this,args);
        if (args[0] === this.context.destination && !window.gameMeter) {
          const meter = this.context.createAnalyser(); meter.fftSize=1024;
          connect.call(this,meter); window.gameMeter=meter;
        }
        return result;
      };
    });
    await page.goto(url);
    const track = page.getByRole("tabpanel"), bounds = await track.boundingBox();
    const cdp = await context.newCDPSession(page), x = bounds.x+bounds.width*.83, y = bounds.y+bounds.height*.48;
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
    for (let i=1; i<=8; i++) {
      await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x-i*18,y}]});
      await delay(17);
    }
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await page.waitForFunction(() => document.querySelector("#palette-track").scrollLeft>70);
    assert.equal(await page.locator("#tick").textContent(),"000","Swiping portraits leaves the field untouched");
    await page.getByRole("tab",{name:"Spells"}).tap();
    await track.getByRole("button",{name:"Meteor",exact:true}).tap();
    const hit = await page.locator("#arena").boundingBox();
    async function castAndMeasure() {
      await page.evaluate(() => {
        window.castAudio = new Promise(resolve => {
          document.querySelector("#arena").addEventListener("pointerdown",() => {
            const began = performance.now(), meter = window.gameMeter, samples = new Float32Array(meter.fftSize), peaks = [0,0];
            function read() {
              meter.getFloatTimeDomainData(samples);
              const t = performance.now()-began, section = t<735 ? 0 : 1;
              for (const s of samples) peaks[section]=Math.max(peaks[section],Math.abs(s));
              if (t < 1450) requestAnimationFrame(read); else resolve(peaks);
            }
            read();
          },{once:true,capture:true});
        });
      });
      await page.touchscreen.tap(hit.x+hit.width*.52,hit.y+hit.height*.54);
      return page.evaluate(() => window.castAudio);
    }
    const [flight,landing] = await castAndMeasure();
    assert.ok(flight>.002 && landing>flight*1.4,"The airy descent and stronger impact reach the speaker: "+[flight,landing]);
    await page.keyboard.press("m");
    assert.equal(await page.locator("#sound-toggle").getAttribute("aria-pressed"),"true");
    const muted=await castAndMeasure(); assert.ok(muted.every(peak=>peak<.0005),"A muted cast is silent");
    await page.reload();
    assert.equal(await page.locator("#sound-toggle").getAttribute("aria-pressed"),"true");
    await page.locator("#sound-toggle").tap();
    assert.equal(await page.locator("#sound-toggle").getAttribute("aria-pressed"),"false");
    console.log("Phone touch scrolling, two audible Meteor cues, silent muted casts and a saved mute preference.");
  } finally { await context.close(); }
}

async function fieldVoices(url) {
  const page=await browser.newPage({viewport:{width:960,height:540}});
  try {
    await page.addInitScript(()=>{
      window.playedCuts=[];
      const start=AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start=function(...args){
        if(this.buffer?.duration>20){
          const slot=Math.round(args[1]/1.25), samples=this.buffer.getChannelData(0), rate=this.buffer.sampleRate;
          const first=Math.round(args[1]*rate), end=first+Math.floor(args[2]*rate);
          let energy=0;
          for(let i=first;i<end;i+=8)energy+=samples[i]*samples[i];
          window.playedCuts.push({slot,energy});
        }
        return start.apply(this,args);
      };
    });
    await page.goto(url+"/?demo=sound");
    const cyclops=page.getByRole("button",{name:"Cyclops",exact:true});
    assert.equal(await cyclops.getAttribute("aria-pressed"),"true");
    assert.equal(await page.locator("#red-count").textContent(),"3");
    await cyclops.click();
    const box=await page.locator("#arena").boundingBox();
    await page.mouse.click(box.x+box.width*548/960,box.y+box.height*.5);
    await page.waitForFunction(()=>{
      const slots=new Set(window.playedCuts.filter(c=>c.energy>1).map(c=>c.slot));
      return slots.has(0) && slots.has(1) && (slots.has(5)||slots.has(6)) &&
        (slots.has(7)||slots.has(8)) && slots.has(10) && (slots.has(12)||slots.has(18));
    },null,{timeout:8500});
    console.log("Live sound: the Archer drew and loosed, the Lancer shouted, the bottle broke, and the Cyclops roared and reacted to damage.");
  } finally {await page.close();}
}

async function playground(url) {
  const {page,point} = await open(url);
  await page.getByRole("button",{name:"Red army"}).click();
  assert.equal(await page.locator("#gold-balance").textContent(),"∞");
  assert.equal(await page.locator("#play").isVisible(),false);
  // Both first armies are drawn on the right. The blue stroke must fight while held.
  await page.mouse.click(...point(652,145));
  await page.waitForFunction(()=>Number(document.querySelector("#tick").textContent) >= 12);
  const idle = await page.locator("#arena").evaluate(c=>c.toDataURL());
  await page.waitForFunction(before=>document.querySelector("#arena").toDataURL() !== before,idle);
  assert.equal(await page.locator("#red-hp").textContent(),String(defs.warrior.maxHp));
  await page.getByRole("button",{name:"Blue army"}).click();
  await page.mouse.move(...point(685,145)); await page.mouse.down();
  await page.waitForFunction(hp=>Number(document.querySelector("#red-hp").textContent)===hp && document.querySelector("#blue-count").textContent==="1",defs.warrior.maxHp-10);
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector("#red-hp").textContent==="0" && document.querySelector("#blue-hp").textContent==="0");
  assert.equal(await page.locator("#result").isVisible(),false);
  await page.getByRole("button",{name:"Violet army"}).click();
  await page.mouse.move(...point(64,190)); await page.mouse.down(); await page.mouse.move(...point(402,190),{steps:15});
  await page.waitForFunction(()=>document.querySelector("#violet-count").textContent==="15");
  await page.mouse.up(); await picture(page,"playground-live");
  await page.locator("#undo").click();
  await page.waitForFunction(()=>document.querySelector("#violet-count").textContent==="0");
  await page.locator("#clear").click();
  await page.getByText("Play modes",{exact:false}).first().click();
  assert.deepEqual(await page.locator(".demo-options a").evaluateAll(links=>links.map(a=>a.getAttribute("href"))),["/","/room/?new","/ffa/?new"]);
  await page.context().close();
  console.log("Playground: idle animation, same-side enemies, live pointer-down fighting, unlimited purchases, grouped undo and continued play.");
}

async function browseRoster(url) {
  const {page,point}=await open(url);
  try {
    const catalog={
      People:["Warrior","Archer","Shieldbearer","Field Medic","Lancer","Bomber","Musketeer","Venom Scout","Miner","Clown","Engineer","Monk","Lion Dancers","Rhino Rider"],
      Machines:["Clockmouse","Bolt Drone","Trojan Horse"],
      Towers:["Watchpost","Mouse Workshop","Stone Lobber","Sun Lens","Bell Tower","Windmill","Harpoon Tower","Prism Tower","Snowman"],
      Mythical:["Cyclops","Storm Kirin","Frost Queen","Phoenix","Reaper","Witch","Zombie","Hydra","Medusa","Vampire","Sandworm","Slime","Headless Horseman","Werewolf","Cerberus","Kraken","Fire Dragon","Iron Golem"],
      Spells:["Gust","Meteor","Healing Rain","Fault Line","Briar Snare","Mirror Ward","Freeze","Lightning","Rage","Wormhole"],
    };
    const portraits=new Set();
    let placed=0;
    for(const [shelf,names] of Object.entries(catalog)) {
      for(const [i,name] of names.entries()) {
        await page.getByRole("tab",{name:shelf,exact:true}).click();
        const panel=page.getByRole("tabpanel");
        const card=panel.getByRole("button",{name,exact:true});
        assert.equal(await card.isEnabled(),true);
        portraits.add(await card.locator("canvas").evaluate(c=>c.toDataURL()));
        if(i===0 && shelf==="Mythical") await picture(page,"roster-mythical");
        await card.click();
        if(shelf==="Spells") {
          assert.equal(await page.locator("#deploy-hint").textContent(),name==="Wormhole" ?
            "Tap an exit. Your mobile troop closest to that spot travels there." : "Tap anywhere to cast "+name+".");
          await page.mouse.click(...point(840,170));
        } else {
          const xy=point(125+(placed%11)*70,112+Math.floor(placed/11)*42);
          assert.equal(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.id,xy),"arena",name+" placement should reach the field");
          await page.mouse.click(...xy);
          await page.waitForFunction(n=>Number(document.querySelector("#red-count").textContent)===n,++placed);
        }
      }
    }
    assert.equal(portraits.size,54);assert.equal(placed,44);
    const panel=page.getByRole("region",{name:"Troops and spells"});
    for(const team of TEAMS) {
      await page.getByRole("button",{name:ARMIES[team].name+" army",exact:true}).click();
      for(const shelf of Object.keys(catalog)) {
        await panel.getByRole("tab",{name:shelf,exact:true}).click();
        const frames=await panel.locator(".palette-card canvas").evaluateAll(canvases=>canvases.map(canvas=>{
          const {width,height}=canvas;
          const ink=canvas.getContext("2d").getImageData(0,0,width,height).data;
          let left=width,top=height,right=-1,bottom=-1,clipped=false;
          for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
            const alpha=ink[(y*width+x)*4+3];
            if(alpha>32 && (x<2 || x>=width-2 || y<2 || y>=height-2)) clipped=true;
            if(alpha<128) continue; // Measure the solid figure above its translucent shadow.
            left=Math.min(left,x); right=Math.max(right,x);
            top=Math.min(top,y); bottom=Math.max(bottom,y);
          }
          return {name:canvas.parentElement.getAttribute("aria-label"),clipped,span:Math.max(right-left,bottom-top)+1};
        }));
        assert.deepEqual(frames.filter(f=>f.clipped).map(f=>f.name),[],team+" portraits need space around each silhouette");
        if(shelf==="Towers") {
          // Compare the longest edge so a horizontal harpoon and a tall spire fit the same space.
          const spans=frames.map(f=>f.span);
          assert.ok(Math.max(...spans)<=1.15*Math.min(...spans),team+" tower portrait sizes: "+spans.join(", "));
        }
      }
    }
    await chooseCard(page,"Towers","Mouse Workshop");
    for(const width of [320,375,390,601,790,1024]) {
      await page.setViewportSize({width,height:650});
      const outside=await page.locator(".tool-strip button:visible:not(.palette-card)").evaluateAll(buttons=>buttons.filter(button=>{
        const r=button.getBoundingClientRect();
        return r.left<0 || r.right>innerWidth || r.bottom>innerHeight;
      }).map(button=>button.textContent));
      assert.deepEqual(outside,[],"Controls outside the field at "+width+"px");
      const slots=await page.locator(".palette-card").evaluateAll(cards=>cards.map(card=>{
        const {width,height,bottom}=card.getBoundingClientRect();return {width,height,bottom};
      }));
      assert.equal(slots.length,9);
      assert.ok(slots.every(s=>s.width>=44 && s.height>=44 && Math.abs(s.bottom-slots[0].bottom)<=3.5),
        "Portraits form one horizontally scrollable, tappable row at "+width+"px");
    }
    assert.equal(await page.locator("#gold-balance").textContent(),"∞");
    console.log("Roster: all 54 portraits fit their cards in four colors, all 44 troops and buildings place, and all ten spells cast.");
  } finally {await page.context().close();}
}

async function magicDuel(url) {
  const red=await open(url+"/room",1000,600), blue=await open(url+"/room",390,700);
  try {
    for (const [player,side] of [[red,"red"],[blue,"blue"]])
      await player.page.waitForFunction(team=>document.querySelector(".game").dataset.team===team,side);
    await chooseCard(red.page,"People","Shieldbearer");
    await red.page.mouse.click(...red.point(320,170));await red.waitForUnits(1);
    await chooseCard(blue.page,"Mythical","Cyclops");
    await blue.page.mouse.click(...blue.point(675,170));await blue.waitForUnits(2);
    const panel=blue.page.getByRole("region",{name:"Troops and spells"});
    await panel.getByRole("tab",{name:"Spells",exact:true}).click();
    assert.equal(await panel.getByRole("button",{name:"Meteor",exact:true}).isEnabled(),false);
    const fits=await panel.boundingBox(),viewport=blue.page.viewportSize();
    assert.ok(fits.x>=0 && fits.x+fits.width<=viewport.width+1 && fits.y>=0);
    await picture(blue.page,"roster-spells-phone");
    assert.equal(await blue.page.locator("#brush-gust").isEnabled(),false);
    await blue.page.keyboard.press("2");
    assert.equal(await blue.page.locator("#brush-meteor").getAttribute("aria-pressed"),"false");
    assert.ok(await blue.page.getByRole("tab",{name:"Mythical"}).evaluate(tab=>tab.hasAttribute("data-armed")));
    assert.equal(Number(await blue.page.locator("#gold-balance").textContent()),120-defs.cyclops.cost);
    await Promise.all([red,blue].map(p=>p.page.getByRole("button",{name:"Ready",exact:true}).click()));
    await red.page.getByText("Live",{exact:true}).waitFor();
    await blue.page.waitForFunction(()=>!document.querySelector("#brush-gust").disabled);
    await chooseCard(red.page,"Spells","Meteor");
    const before=red.frames.at(-1);
    await red.page.mouse.move(...red.point(856,180));await red.page.mouse.down();
    await red.page.mouse.move(...red.point(880,210));await red.page.mouse.up();
    await blue.page.waitForFunction(()=>document.querySelector("#blue-score").dataset.baseHp==="154");
    const proof=red.frames.find(f=>f.world.spells?.some(s=>s.kind==="meteor"));
    assert.ok(proof);const effect=proof.world.spells[0];
    assert.equal(effect.team,"red");
    assert.ok(Math.abs(effect.x-856)<0.001 && Math.abs(effect.y-180)<0.001);
    assert.equal(proof.gold.red,before.gold.red-20+4*(Math.floor(proof.world.tick/60)-Math.floor(before.world.tick/60)));
    assert.equal(new Set(red.frames.flatMap(f=>(f.world.spells??[]).map(s=>s.id))).size,1);
    await blue.page.reload({waitUntil:"domcontentloaded"});
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue" &&
      document.querySelector("#blue-score").dataset.baseHp==="154");
    assert.equal(blue.joins[1].resumeToken,blue.joins[0].resumeToken);
    assert.equal(await blue.page.getByRole("tab",{name:"Spells"}).getAttribute("aria-selected"),"true");
    await blue.page.getByRole("tab",{name:"Mythical"}).click();
    assert.equal(await blue.page.locator("#brush-cyclops").getAttribute("aria-pressed"),"true");
    const frame=blue.frames.at(-1);
    const until=Date.now()+3000;
    while(!red.frames.some(f=>f.revision===frame.revision) && Date.now()<until) await delay(10);
    assert.deepEqual(red.frames.find(f=>f.revision===frame.revision)?.world,frame.world);
    assert.deepEqual(frame.world.units.map(u=>u.kind),["shieldbearer","cyclops"]);
    console.log("Two-client roster and magic: a 390px client bought a Cyclops, saw a cross-field Meteor hit its base, and rejoined the same world.");
  } finally {await Promise.all([red,blue].map(p=>p.page.context().close()));}
}

async function weatherDuel(url) {
  const red=await open(url+"/room",1024,640),blue=await open(url+"/room",390,700),players=[red,blue];
  try {
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue");
    await chooseCard(red.page,"People","Archer");
    await red.page.mouse.click(...red.point(235,170));await red.waitForUnits(1);
    await chooseCard(blue.page,"Towers","Bell Tower");
    await blue.page.mouse.click(...blue.point(828,178));await blue.waitForUnits(2);
    await Promise.all(players.map(p=>p.page.getByRole("tab",{name:"Spells"}).click()));
    for(const name of ["Freeze","Lightning","Rage"])assert.equal(await red.page.getByRole("button",{name,exact:true}).isEnabled(),false);
    await Promise.all(players.map(p=>p.page.getByRole("button",{name:"Ready",exact:true}).click()));
    await red.page.getByText("Live",{exact:true}).waitFor();
    const cast=async(p,name,x,y)=>{
      await p.page.getByRole("button",{name,exact:true}).click();await p.page.mouse.click(...p.point(x,y));
    };
    await Promise.all([cast(red,"Freeze",843,180),cast(blue,"Lightning",104,180)]);
    const archer=red.frames.at(-1).world.units.find(u=>u.kind==="archer");
    await cast(red,"Rage",archer.x+28,archer.y);
    const together=f=>{
      const w=f.world;
      return w.spells?.some(s=>s.kind==="lightning" && s.strikes?.some(a=>a.id===w.bases[0].id)) &&
        w.units[1].frozenUntil>w.tick && w.units[0].raging && w.bases[0].hp===154;
    };
    const deadline=Date.now()+3800;
    while(!blue.frames.some(together) && Date.now()<deadline)await delay(10);
    const proof=blue.frames.find(together);
    assert.ok(proof,"the phone sees lightning hit Red's base while Blue's tower is frozen and Red's Archer is enraged");
    const serverTick=proof.world.tick;
    await blue.page.reload({waitUntil:"domcontentloaded"});
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue" &&
      document.querySelector("#red-score").dataset.baseHp==="154");
    assert.equal(blue.joins[1].resumeToken,blue.joins[0].resumeToken);
    const frame=blue.frames.at(-1),limit=Date.now()+3000;
    assert.ok(frame.world.tick>=serverTick && frame.world.spells.some(s=>s.kind==="rage"));
    while(!red.frames.some(f=>f.revision===frame.revision) && Date.now()<limit)await delay(10);
    assert.deepEqual(red.frames.find(f=>f.revision===frame.revision)?.world,frame.world);
    console.log("Weather duel: desktop and phone saw all three spells, the same lightning damage, and the same world after a reconnect.");
  } finally {await Promise.all(players.map(p=>p.page.context().close()));}
}

async function siegeDuel(url) {
  const red=await open(url+"/room",1024,660),blue=await open(url+"/room",390,700);
  const players=[red,blue];
  try {
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue");
    const formation=[[red,"Bell Tower",439,179],[red,"Sun Lens",360,103],[red,"Stone Lobber",265,219],
      [blue,"Watchpost",545,179],[blue,"Bell Tower",500,97]];
    for(const [i,[player,name,x,y]] of formation.entries()) {
      await chooseCard(player.page,"Towers",name);
      await player.page.mouse.click(...player.point(x,y));await player.waitForUnits(i+1);
    }
    assert.equal(Number(await red.page.locator("#gold-balance").textContent()),50);
    await red.page.getByRole("tab",{name:"Spells"}).click();
    assert.equal(await red.page.locator("#brush-mirror").isEnabled(),false);
    await Promise.all(players.map(p=>p.page.getByRole("button",{name:"Ready",exact:true}).click()));
    await red.page.getByText("Live",{exact:true}).waitFor();
    await chooseCard(red.page,"Spells","Mirror Ward");await red.page.mouse.click(...red.point(443,179));
    const rebounded=f=>f.world.spells?.some(s=>s.kind==="mirror" && s.reflection?.count>=1);
    const timeout=Date.now()+4500;
    while(!blue.frames.some(rebounded) && Date.now()<timeout)await delay(15);
    const first=blue.frames.find(rebounded);
    assert.ok(first,"the Watchpost shot should reach the ward");
    assert.equal(first.world.units.find(u=>u.kind==="sunlens").targetId,5);
    await blue.page.reload({waitUntil:"domcontentloaded"});
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue");
    const limit=Date.now()+3000;
    while((!blue.frames.some(f=>f.revision>first.revision && rebounded(f)) || blue.joins.length<2) && Date.now()<limit)await delay(15);
    assert.equal(blue.joins[1].resumeToken,blue.joins[0].resumeToken);
    const frame=blue.frames.at(-1);
    assert.ok(rebounded(frame),"the returning phone still sees the spent pane");
    while(!red.frames.some(f=>f.revision===frame.revision) && Date.now()<limit)await delay(10);
    assert.deepEqual(red.frames.find(f=>f.revision===frame.revision)?.world,frame.world);
    console.log("Siege duel: three towers bought on desktop, a Watchpost bolt reflected, and the returning phone saw the same spent pane and Sun Lens lock.");
  } finally {await Promise.all(players.map(p=>p.page.context().close()));}
}

async function siegePlayground(url) {
  const {page,point}=await open(url+"/?demo=siege",390,700,true);
  try {
    assert.equal(await page.locator("#blue-count").textContent(),"3");
    assert.equal(await page.locator("#brush-fault").getAttribute("aria-pressed"),"true");
    await page.mouse.click(...point(442,178));await page.clock.runFor(880);
    assert.equal(await page.locator("#blue-hp").textContent(),String(defs.lobber.maxHp+defs.sunlens.maxHp+defs.belltower.maxHp-48));
    await page.reload();await page.getByRole("button",{name:"Fault Line",exact:true}).waitFor();
    assert.equal(await page.locator("#blue-hp").textContent(),String(defs.lobber.maxHp+defs.sunlens.maxHp+defs.belltower.maxHp));
    console.log("Siege playground: the direct link opens three towers, two towers take both tremors, and reload restores the lineup.");
  } finally {await page.context().close();}
}

async function stormDuel(url) {
  const red=await open(url+"/room",1040,620),blue=await open(url+"/room",640,510);
  try {
    await red.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="red");
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue");
    await chooseCard(red.page,"Mythical","Storm Kirin");
    await red.page.mouse.click(...red.point(438,165));await red.waitForUnits(1);
    await chooseCard(blue.page,"People","Lancer");
    await blue.page.mouse.click(...blue.point(666,165));await blue.waitForUnits(2);
    await chooseCard(blue.page,"Towers","Watchpost");
    for(const [i,x] of [660,716,772].entries()) {
      await blue.page.mouse.click(...blue.point(x,190));await blue.waitForUnits(3+i);
    }
    await Promise.all([red,blue].map(p=>p.page.getByRole("button",{name:"Ready",exact:true}).click()));
    const deadline=Date.now()+10000;
    let contact;
    while(!contact && Date.now()<deadline){
      contact=blue.frames.find(f=>f.world.units.find(u=>u.kind==="kirin")?.arc?.path.length===5);
      if(!contact)await delay(12);
    }
    assert.ok(contact,"no four-target chain reached the blue browser");
    const spark=contact.world.units.find(u=>u.kind==="kirin").arc;
    const enemies=contact.world.units.filter(u=>u.team==="blue");
    assert.ok(enemies.every(u=>u.stunnedUntil>contact.world.tick));
    assert.ok(blue.frames.some(f=>f.world.tick<spark.tick && f.world.units.some(u=>u.kind==="lancer" && u.runUp>=52)));
    assert.equal(enemies.find(u=>u.kind==="lancer").runUp,0);
    await blue.page.reload({waitUntil:"domcontentloaded"});
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue" && Number(document.querySelector("#tick").textContent)>0);
    assert.equal(blue.joins[0].resumeToken,blue.joins[1].resumeToken);
    const latest=blue.frames.at(-1),limit=Date.now()+3000;
    while(!red.frames.some(f=>f.revision===latest.revision) && Date.now()<limit)await delay(10);
    assert.deepEqual(red.frames.find(f=>f.revision===latest.revision)?.world,latest.world);
    assert.deepEqual(latest.world.units.map(u=>u.id),contact.world.units.map(u=>u.id));
    assert.ok(latest.world.units.find(u=>u.kind==="kirin").arc.tick>=spark.tick);
    console.log("Chain stun: both browsers agreed on four stunned enemies, the Lancer lost a full charge, and the returning player recovered the same world.");
  } finally {await Promise.all([red,blue].map(p=>p.page.context().close()));}
}

async function turncoatDuel(url) {
  const red=await open(url+"/room",1000,600),blue=await open(url+"/room",430,700);
  const players=[red,blue];
  try {
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue");
    await red.page.mouse.click(...red.point(700,245));
    assert.match(await red.page.locator("#deploy-hint").textContent(),/whole stroke/);
    await chooseCard(red.page,"People","Miner");
    assert.match(await red.page.locator("#deploy-hint").textContent(),/exit anywhere/);
    await red.page.mouse.click(...red.point(700,245));await red.waitForUnits(1);
    await chooseCard(red.page,"Mythical","Witch");await red.page.mouse.click(...red.point(445,105));await red.waitForUnits(2);
    await chooseCard(red.page,"Mythical","Zombie");await red.page.mouse.click(...red.point(462,270));await red.waitForUnits(3);
    await blue.page.getByRole("button",{name:"Archer",exact:true}).click();await blue.page.mouse.click(...blue.point(488,270));await blue.waitForUnits(4);
    await chooseCard(blue.page,"People","Shieldbearer");await blue.page.mouse.click(...blue.point(516,105));await blue.waitForUnits(5);
    await chooseCard(blue.page,"Towers","Watchpost");await blue.page.mouse.click(...blue.point(585,92));
    await Promise.all(players.map(p=>p.waitForUnits(6)));
    const destination=red.frames.at(-1).world.units[0].tunnel;
    assert.deepEqual([destination.toX,destination.toY].map(Math.round),[700,245]);
    await Promise.all(players.map(p=>p.page.getByRole("button",{name:"Ready",exact:true}).click()));
    await blue.page.waitForFunction(()=>document.querySelector("#red-score").title.includes("Hex Pig") && document.querySelector("#red-score").title.includes("Zombie 2"));
    const contact=blue.frames.find(f=>f.world.units[4]?.kind==="pig");
    const pig=contact.world.units[4];
    assert.ok(contact.world.units[0].tunnel && contact.world.units[0].x>destination.fromX);
    assert.equal(contact.world.units[3].zombified.kind,"archer");
    await picture(red.page,"witch-and-zombies");
    await blue.page.waitForFunction(tick=>Number(document.querySelector("#tick").textContent)>=tick,pig.hex.since+210);
    await blue.page.reload({waitUntil:"domcontentloaded"});
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue" && document.querySelector("#red-score").title.includes("Hex Pig"));
    assert.equal(blue.joins[0].resumeToken,blue.joins[1].resumeToken);
    const returned=blue.frames.at(-1),limit=Date.now()+3000;
    while(!red.frames.some(f=>f.revision===returned.revision) && Date.now()<limit)await delay(10);
    assert.deepEqual(red.frames.find(f=>f.revision===returned.revision)?.world,returned.world);
    const stillPig=returned.world.units.find(u=>u.id===pig.id);
    assert.ok(returned.world.tick>=pig.hex.since+210 && stillPig.hp>0);
    assert.deepEqual([stillPig.kind,stillPig.team,stillPig.hex.kind],["pig","red","shieldbearer"]);
    await chooseCard(red.page,"People","Miner");await red.page.mouse.click(...red.point(738,206));
    await Promise.all(players.map(p=>p.waitForUnits(7)));
    assert.ok(blue.frames.at(-1).world.units[6].tunnel.toX>700);
    assert.ok(red.frames.some(f=>f.world.units[0]?.emergedTick && !f.world.units[0].tunnel));
    console.log("Both browsers agreed on the permanent Hex Pig, its health and its team after reconnect, alongside cross-field Miners and a turned Archer.");
  } finally {await Promise.all(players.map(p=>p.page.context().close()));}
}

const formations = [
  [[413,147],[328,137]], [[552,142],[617,125]],
  [[448,218],[381,246]], [[605,230],[662,255]],
];
async function match(url,size) {
  const players=[];
  try {
    for (let i=0; i<size; i++) {
      const player=await open(url+"/ffa", [1000,710,575,395][i], [600,545,635,710][i]);
      players.push(player);
      await player.page.waitForFunction(team=>document.querySelector(".game").dataset.team===team &&
        document.querySelector("#gold-balance").textContent==="120", TEAMS[i]);
    }
    const first=players[0];
    await first.page.mouse.move(...first.point(64,103)); await first.page.mouse.down();
    await first.page.mouse.move(...first.point(404,103),{steps:14}); await first.page.mouse.up();
    assert.match(await first.page.locator("#deploy-hint").textContent(),/180 gold/);
    assert.equal(first.frames.at(-1).world.units.length,0);
    for (const [i,player] of players.entries()) {
      const [warrior,archer]=formations[i];
      await player.page.mouse.click(...player.point(...warrior));
      await player.page.getByRole("button",{name:"Archer",exact:true}).click();
      await player.page.mouse.click(...player.point(...archer));
      await player.page.waitForFunction(()=>document.querySelector("#gold-balance").textContent==="100");
    }
    const expected=TEAMS.slice(0,size);
    const allPlaced=frame=>frame?.phase==="deploy" && frame.world.units.length===size*2;
    await Promise.all(players.map(p=>p.waitForUnits(size*2)));
    assert.ok(players.every(p=>allPlaced(p.frames.at(-1))));
    const deploy=players.at(-1).frames.at(-1);
    for (const player of players) assert.deepEqual(player.frames.at(-1),deploy);
    await picture(players.at(-1).page,"ffa-"+size+"-deployment");
    await Promise.all(players.slice(0,-1).map(p=>p.page.getByRole("button",{name:"Ready",exact:true}).click()));
    assert.equal(first.frames.at(-1).phase,"deploy");
    await players.at(-1).page.getByRole("button",{name:"Ready",exact:true}).click();
    await first.page.locator("#countdown").waitFor({state:"visible"});
    await first.page.waitForFunction(()=>Number(document.querySelector("#tick").textContent)>=12);
    const countdown=first.frames.filter(f=>f.phase==="countdown");
    assert.deepEqual([...new Set(countdown.map(f=>f.countdown))],[3,2,1]);
    assert.ok(countdown.every(f=>f.world.tick===0));
    if (size===3) {
      const returning=players[2];
      await returning.page.reload({waitUntil:"domcontentloaded"});
      await returning.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="violet" && Number(document.querySelector("#tick").textContent)>=12);
      assert.equal(returning.joins.length,2);
      assert.equal(returning.joins[0].resumeToken,returning.joins[1].resumeToken);
      assert.ok(returning.frames.at(-1).seats.violet.connected);
    }
    await first.page.waitForFunction(()=>Number(document.querySelector("#tick").textContent)>=60);
    assert.ok(first.frames.find(f=>f.phase==="running" && f.world.tick===60).gold.red>=104);
    const buyer=players.at(-1);
    await buyer.page.getByRole("button",{name:"Warrior",exact:true}).click();
    const [x,y]=formations[size-1][0];
    await buyer.page.mouse.move(...buyer.point(x,y-16)); await buyer.page.mouse.down();
    await first.waitForUnits(deploy.world.units.length+1);
    await buyer.page.mouse.move(...buyer.point(x,y+83),{steps:6});
    await first.waitForUnits(deploy.world.units.length+5);
    await buyer.page.mouse.up();
    await picture(first.page,"ffa-"+size+"-battle");
    await Promise.all(players.map(p=>p.page.locator("#result").waitFor({state:"visible"})));
    const end=first.frames.at(-1);
    assert.equal(end.phase,"finished");
    assert.ok([...expected,"draw"].includes(end.outcome));
    assert.ok(end.world.bases.filter(b=>b.hp>0).length<=1);
    for (const player of players) {
      assert.deepEqual(player.frames.at(-1),end);
      assert.deepEqual(end.world.units.slice(0,size*2).map(u=>u.id),deploy.world.units.map(u=>u.id));
      assert.equal(end.world.units.length, size*2+5);
      const side=player.joins[0].team, base=end.world.bases.find(b=>b.team===side);
      const passive=Math.floor((base.hp>0 ? end.world.tick : base.lastHitTick-1)/60)*4;
      const bounties=end.world.units.filter(u=>u.killedBy===side).reduce((sum,u)=>sum+(u.kind==="warrior"?6:4),0);
      assert.equal(end.gold[side],100+passive+bounties-(player===buyer?60:0));
      assert.equal(Number(await player.page.locator("#gold-balance").textContent()),end.gold[side]);
    }
    await first.page.getByRole("button",{name:"New round"}).click();
    await Promise.all(players.map(p=>p.page.waitForFunction(()=>document.querySelector("#gold-balance").textContent==="120" &&
      document.querySelector("#arena").dataset.deploying==="true")));
    assert.ok(players.every(p=>p.frames.at(-1).world.units.length===0));
    console.log(size+"-player FFA: equal 120 gold, same units, winner "+end.outcome+" at tick "+end.world.tick+", all purses reset.");
  } finally { await Promise.all(players.map(p=>p.page.context().close())); }
}

try {
  await withField(url => checkPausedPlacement(browser, url));
  await withField(pausePlayground);
  await withField(phoenixDuringDeployment);
  await withField(arrowFlash);
  await withField(paletteAndMeteor);
  await withField(touchAndSound);
  await withField(fieldVoices);
  await withField(playground);
  await withField(browseRoster);
  await withField(siegePlayground);
  await withField(magicDuel);
  await withField(weatherDuel);
  await withField(siegeDuel);
  await withField(stormDuel);
  await withField(turncoatDuel);
  await withField(url=>match(url,3));
  await withField(url=>match(url,4));
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
