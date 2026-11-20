import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { createGameServer } from "../server/http.ts";

const {values}=parseArgs({options:{headless:{type:"boolean"}, frames:{type:"string"}, channel:{type:"string"}}});
const headless=!!values.headless;
const {http,closeRoom}=createGameServer();
http.listen(0,"127.0.0.1");await once(http,"listening");
let browser;
try {
  browser=await chromium.launch({headless,channel:values.channel??(existsSync(chromium.executablePath())?undefined:"chrome")});
  const page=await browser.newPage({viewport:{width:960,height:540}});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  const clock=new Date("2026-01-01T12:00:00Z");
  await page.clock.install({time:clock});
  await page.clock.pauseAt(new Date(clock.getTime()+1000));
  await page.goto("http://127.0.0.1:"+http.address().port+"/");
  await page.getByRole("button",{name:"Roster",exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const panel=page.getByRole("region",{name:"Troops and spells"});
  const press=button=>button.click({force:true});
  async function select(shelf,name) {
    await press(page.getByRole("button",{name:"Roster",exact:true}));
    await press(panel.getByRole("button",{name:shelf,exact:true}));
    await press(panel.getByRole("button",{name,exact:true}));
  }
  async function color(team){await press(page.getByRole("button",{name:team+" army",exact:true}));}
  const stamp=(x,y)=>page.mouse.click(x,y*540/360);
  async function setYard(){
    await color("Red");await select("Myths","Giant");await stamp(405,170);
    await color("Blue");await select("People","Barrel Roller");await stamp(555,170);
  }
  let index=0;
  const sequence=[];
  if(values.frames)await mkdir(values.frames,{recursive:true});
  async function show(ms,label) {
    for(let i=0;i<Math.ceil(ms/50);i++){
      if(values.frames) {
        const filename=String(index++).padStart(4,"0")+".png";
        await page.screenshot({path:join(values.frames,filename),clip:{x:270,y:155,width:420,height:194}});
        sequence.push({filename,label});
      }
      if(!headless)await delay(50);
      await page.clock.runFor(50);
    }
  }
  await setYard();
  console.log("First encounter: the Giant catches the oncoming barrel and bowls it back.");
  await show(700,"Watch the Giant's hands.");
  await show(1050,"Watch the Giant's hands.");
  await show(1150,"He bowls it back.");
  assert.equal(await page.locator("#blue-hp").textContent(),"12");
  await press(page.getByRole("button",{name:"Clear",exact:true}));
  await setYard();
  await color("Red");await select("Machines","Clockmouse");
  await show(950,"Now give him a friendly Clockmouse.");
  await stamp(475,177);
  console.log("Second encounter: a friendly Clockmouse arrives while the Giant is holding the barrel.");
  await show(450,"Now give him a friendly Clockmouse.");
  assert.equal(await page.locator("#red-count").textContent(),"2");
  assert.equal(await page.locator("#blue-hp").textContent(),"25");
  await show(1250,"He drops the barrel and runs.");
  assert.equal(await page.locator("#blue-hp").textContent(),"22");
  assert.equal(await page.locator("#red-count").textContent(),"1");
  assert.deepEqual(errors,[]);
  if(values.frames)await writeFile(join(values.frames,"timeline.json"),JSON.stringify(sequence));
  console.log("PASS: two different outcomes on the ordinary playable field.");
  if(!headless){await page.clock.resume();console.log("The playground is yours. Close the window when finished.");await page.waitForEvent("close",{timeout:0});}
} finally {
  await browser?.close();closeRoom();await new Promise(resolve=>http.close(resolve));
}
