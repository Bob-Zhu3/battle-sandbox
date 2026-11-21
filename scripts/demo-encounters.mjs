import assert from "node:assert/strict";
import { playOddities } from "./oddities-scenes.mjs";
import { playMotion } from "./motion-scenes.mjs";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { createGameServer } from "../server/http.ts";

const {values} = parseArgs({options:{oddities:{type:"boolean"}, motion:{type:"boolean"}, headless:{type:"boolean"}, frames:{type:"string"}, channel:{type:"string"}}});
const {http,closeRoom} = createGameServer();
http.listen(0,"127.0.0.1");
await once(http,"listening");
let browser;
try {
  browser=await chromium.launch({headless:!!values.headless,channel:values.channel ?? (existsSync(chromium.executablePath()) ? undefined : "chrome")});
  const page=await browser.newPage({viewport:{width:1152,height:648},deviceScaleFactor:1.5});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  const clock=new Date("2026-01-01T12:00:00Z");
  await page.clock.install({time:clock});
  await page.clock.pauseAt(new Date(clock.getTime()+1000));
  await page.goto("http://127.0.0.1:"+http.address().port+"/");
  await page.getByRole("button",{name:"Roster",exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const panel=page.getByRole("region",{name:"Troops and spells"});
  const click=button=>button.click({force:true});
  const button=(container,name)=>container.getByRole("button",{name,exact:true});
  const shelves = {
    People:["Lancer","Musketeer","Venom Scout","Bomber","Miner","Clown","Shieldbearer","Engineer"],
    Machines:["Watchpost"], Mythical:["Storm Kirin","Cyclops","Frost Queen","Phoenix","Reaper","Witch","Zombie"], Spells:["Healing Rain","Gust"],
  };
  async function brush(team,name) {
    await click(button(page,team+" army"));
    if(name==="Warrior" || name==="Archer"){await click(button(page,name));return;}
    const shelf=Object.keys(shelves).find(key=>shelves[key].includes(name));
    await click(button(page,"Roster"));
    await click(button(panel,shelf));
    await click(button(panel,name));
  }
  const arena=await page.locator("#arena").boundingBox();
  const stamp=(x,y)=>page.mouse.click(arena.x+x*arena.width/960,arena.y+y*arena.height/360);
  async function place(team,name,x,y) {await brush(team,name);await stamp(x,y);}
  async function clear(){await click(button(page,"Clear"));}
  const hp=async team=>Number(await page.locator("#"+team+"-hp").textContent());
  const frames=[];
  if(values.frames)await mkdir(values.frames,{recursive:true});
  const crop={x:327,y:130,width:422,height:291};
  async function show(ms,label,hold=false) {
    for(let i=0;i<ms;i+=50){
      if(values.frames){
        const filename=String(frames.length).padStart(4,"0")+".png";
        await page.screenshot({path:join(values.frames,filename),clip:crop});
        frames.push({filename,label});
      }
      if(!values.headless) await delay(50);
      if(!hold) await page.clock.runFor(50);
    }
  }
  if(values.motion) await playMotion({place,show,clear,hp});
  else if(values.oddities) await playOddities({page,place,show,clear,hp});
  else {
    await place("Red","Watchpost",300,166);
    await place("Blue","Lancer",515,170);await place("Blue","Watchpost",500,228);
    await place("Blue","Venom Scout",555,212);await place("Blue","Bomber",590,180);
    await show(700,"The Lancer lowers his spear.");
    assert.equal(await hp("blue"),107);
    await place("Red","Storm Kirin",407,132);
    await show(150,"One bolt stuns all four enemies.");
    await show(850,"One bolt stuns all four enemies.",true);
    assert.equal(await hp("blue"),83);
    await show(650,"The Lancer has to build up speed again.");
    await clear();

    await place("Red","Cyclops",420,175);
    await place("Blue","Lancer",470,175);await place("Blue","Archer",474,202);await place("Blue","Musketeer",487,150);
    await show(450,"Watch the club come up.");
    await show(250,"The impact throws the front line back.");
    await show(700,"The impact throws the front line back.",true);
    assert.equal(await hp("blue"),21);
    await show(500,"The wounded Lancer comes back within reach.");
    await show(200,"The Cyclops swallows him.");
    await show(550,"The Cyclops swallows him.",true);
    assert.equal(await page.locator("#blue-count").textContent(),"2");
    await clear();

    await place("Red","Frost Queen",405,180);await place("Blue","Lancer",525,171);
    await place("Blue","Warrior",543,199);await place("Red","Phoenix",398,225);
    await show(550,"The Queen slows the front line.");
    await place("Red","Healing Rain",419,194);
    await show(400,"Red crosses rise with the healing pulse.");
    await show(600,"Red crosses rise with the healing pulse.",true);
    await show(350,"The Phoenix leaves fire on its target.");
    await clear();

    await place("Red","Phoenix",410,183);await place("Blue","Warrior",430,174);
    await place("Blue","Warrior",432,193);await place("Blue","Musketeer",518,183);
    await show(700,"The Phoenix falls into an ember egg.");
    assert.equal(await hp("red"),1);
    await show(600,"The Phoenix falls into an ember egg.",true);
    await place("Red","Gust",406,183);
    await show(250,"A friendly Gust hatches it early.");
    await show(600,"A friendly Gust hatches it early.",true);
    assert.equal(await hp("red"),16);
  }
  assert.deepEqual(errors,[]);
  if(values.frames) {
    await writeFile(join(values.frames,"timeline.json"),JSON.stringify(frames));
    const characters = values.motion ? [
      ["Blue","Mythical","Phoenix","Flight and talon strike"], ["Blue","Mythical","Cyclops","Ground smash"],
      ["Red","People","Musketeer","Recoil and reload"], ["Violet","Mythical","Storm Kirin","Chain lightning"],
    ] : values.oddities ? [
      ["Amber","People","Miner","Cross-field tunnels"], ["Red","People","Clown","Poison balloons"],
      ["Violet","Mythical","Reaper","Soul harvest"], ["Blue","Mythical","Witch","Hex Pig"],
    ] : [
      ["Red","Mythical","Cyclops","Ground smash"], ["Blue","Mythical","Storm Kirin","Chain stun"],
      ["Violet","Mythical","Frost Queen","Frost burst"], ["Red","Mythical","Phoenix","Fire and rebirth"],
      ["Amber","People","Bomber","Blast radius"], ["Blue","People","Musketeer","Piercing shot"],
      ["Violet","People","Venom Scout","Poison dart"], ["Red","Mythical","Zombie","Infectious bite"],
    ];
    const cards=[];
    for(const [team,shelf,name,skill] of characters){
      await click(button(page,team+" army"));await click(button(page,"Roster"));await click(button(panel,shelf));
      const portrait=await button(panel,name).locator("canvas").evaluate(c=>c.toDataURL());
      cards.push({name,skill,portrait});await click(button(panel,"Close roster"));
    }
    const sheet=await page.evaluate(async cards=>{
      await document.fonts.load('800 22px "Barlow Condensed"');
      const canvas=document.createElement("canvas");canvas.width=820;canvas.height=Math.ceil(cards.length/4)*163;
      const c=canvas.getContext("2d");
      c.fillStyle="#fff3d7";c.fillRect(0,0,820,canvas.height);c.strokeStyle="#c8bb91";c.lineWidth=1;
      c.beginPath();c.moveTo(20,164);c.lineTo(800,164);c.stroke();c.textAlign="center";
      for(const [i,card] of cards.entries()){
        const image=new Image();image.src=card.portrait;await image.decode();
        const x=102+(i%4)*205,y=Math.floor(i/4)*163;
        c.drawImage(image,x-61,y+1,122,122);
        c.fillStyle="#283830";c.font='800 23px "Barlow Condensed"';c.fillText(card.name,x,y+126);
        c.fillStyle="#52604c";c.font='600 13px "Bricolage Grotesque"';c.fillText(card.skill,x,y+146);
      }
      return canvas.toDataURL("image/png").split(",")[1];
    },cards);
    await writeFile(join(values.frames,"portraits.png"),Buffer.from(sheet,"base64"));
  }
  if(values.motion) console.log("PASS: four encounters, from the Phoenix's first wingbeat to the Kirin's lightning strike.");
  else if(values.oddities) console.log("PASS: tunnels, counterattacking pigs, direct Zombie conversions, poison clouds, soul harvests and mythical trails.");
  else console.log("PASS: four enemies struck, the Cyclops scattered a line and swallowed a wounded Lancer, and a one-HP egg hatched at half health.");
  if(!values.headless) {
    await clear();
    if(values.motion){
      await place("Blue","Phoenix",391,181);await place("Blue","Warrior",464,184);
      await place("Blue","Storm Kirin",538,181);await place("Blue","Frost Queen",616,181);
      await place("Blue","Lancer",435,234);await place("Blue","Cyclops",509,234);
      await place("Blue","Reaper",581,234);await place("Blue","Witch",653,234);
      await brush("Red","Shieldbearer");
    }
    else if(values.oddities){await place("Red","Zombie",397,166);await brush("Blue","Archer");}
    else {await place("Red","Storm Kirin",392,166);await brush("Blue","Lancer");}
    await page.clock.resume();
    if(values.motion) console.log("Your turn. The Blue Phoenix leads the line. Place a Red Shieldbearer in front of it to see the strike. Close the window when finished.");
    else if(values.oddities) console.log("Your turn. Place a Blue Archer by the waiting Red Zombie. Close the window when finished.");
    else console.log("Your turn. Draw Blue Lancers in front of the Storm Kirin. Close the window when finished.");
    await page.waitForEvent("close",{timeout:0});
  }
} finally {
  await browser?.close();closeRoom();await new Promise(resolve=>http.close(resolve));
}
