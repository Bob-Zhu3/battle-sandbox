import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { createGameServer } from "../server/http.ts";
import { ARENA, TEAMS } from "../src/battlefield.ts";

const { values } = parseArgs({ options: { channel: { type: "string" }, output: { type: "string" } } });
const browser = await chromium.launch({ headless: true, channel: values.channel ?? (existsSync(chromium.executablePath()) ? undefined : "chrome") });
const errors = [];
if (values.output) await mkdir(values.output, { recursive: true });

async function open(url, width = 1000, height = 600) {
  const page = await browser.newPage({ viewport: { width, height } });
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
async function selectFromRoster(page, shelf, name) {
  await page.getByRole("button",{name:"Roster",exact:true}).click();
  const panel=page.getByRole("region",{name:"Troops and spells"});
  await panel.getByRole("button",{name:shelf,exact:true}).click();
  await panel.getByRole("button",{name,exact:true}).click();
}
async function picture(page, name) {
  if (values.output) await page.screenshot({ path: join(values.output, name + ".png") });
}
async function withField(check) {
  const {http,closeRoom} = createGameServer();
  http.listen(0,"127.0.0.1"); await once(http,"listening");
  try { await check("http://127.0.0.1:" + http.address().port); }
  finally { closeRoom(); await new Promise(resolve => http.close(resolve)); }
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
  assert.equal(await page.locator("#red-hp").textContent(),"30");
  await page.getByRole("button",{name:"Blue army"}).click();
  await page.mouse.move(...point(685,145)); await page.mouse.down();
  await page.waitForFunction(()=>document.querySelector("#red-hp").textContent==="20" && document.querySelector("#blue-count").textContent==="1");
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
  assert.deepEqual(await page.locator(".demo-options a").evaluateAll(links=>links.map(a=>a.getAttribute("href"))),["/","/room","/ffa"]);
  await page.context().close();
  console.log("Playground: idle animation, same-side enemies, live pointer-down fighting, unlimited purchases, grouped undo and continued play.");
}

async function browseRoster(url) {
  const {page,point}=await open(url);
  try {
    const catalog={
      People:["Warrior","Archer","Shieldbearer","Field Medic","Lancer","Bomber","Musketeer","Venom Scout","Miner","Clown","Engineer"],
      Machines:["Clockmouse","Bolt Drone","Mouse Workshop","Watchpost"],
      Mythical:["Cyclops","Storm Kirin","Frost Queen","Phoenix","Reaper","Witch","Zombie"],
      Spells:["Gust","Meteor","Healing Rain"],
    };
    const portraits=new Set();
    let placed=0;
    for(const [shelf,names] of Object.entries(catalog)) {
      for(const [i,name] of names.entries()) {
        await page.getByRole("button",{name:"Roster",exact:true}).click();
        const panel=page.getByRole("region",{name:"Troops and spells"});
        await panel.getByRole("button",{name:shelf,exact:true}).click();
        const card=panel.getByRole("button",{name,exact:true});
        assert.equal(await card.isEnabled(),true);
        portraits.add(await card.locator("canvas").evaluate(c=>c.toDataURL()));
        if(i===0 && shelf==="Mythical") await picture(page,"roster-mythical");
        await card.click();
        if(shelf==="Spells") {
          assert.equal(await page.locator("#deploy-hint").textContent(),"Tap anywhere to cast "+name+".");
          await page.mouse.click(...point(840,170));
        } else {
          await page.mouse.click(...point(125+(placed%9)*86,125+Math.floor(placed/9)*78));
          await page.waitForFunction(n=>Number(document.querySelector("#red-count").textContent)===n,++placed);
        }
      }
    }
    assert.equal(portraits.size,25);assert.equal(placed,22);
    await selectFromRoster(page,"Machines","Mouse Workshop");
    for(const width of [375,601,790,1024]) {
      await page.setViewportSize({width,height:650});
      const outside=await page.locator(".tool-strip button:visible").evaluateAll(buttons=>buttons.filter(button=>{
        const r=button.getBoundingClientRect();
        return r.left<0 || r.right>innerWidth || r.bottom>innerHeight;
      }).map(button=>button.textContent));
      assert.deepEqual(outside,[],"Controls outside the field at "+width+"px");
    }
    assert.equal(await page.locator("#gold-balance").textContent(),"∞");
    console.log("Roster: every entry has a distinct portrait, all 22 pieces place, and all three spells cast in the playground.");
  } finally {await page.context().close();}
}

async function magicDuel(url) {
  const red=await open(url+"/room",1000,600), blue=await open(url+"/room",390,700);
  try {
    for (const [player,side] of [[red,"red"],[blue,"blue"]])
      await player.page.waitForFunction(team=>document.querySelector(".game").dataset.team===team,side);
    await selectFromRoster(red.page,"People","Shieldbearer");
    await red.page.mouse.click(...red.point(320,170));await red.waitForUnits(1);
    await selectFromRoster(blue.page,"Mythical","Cyclops");
    await blue.page.mouse.click(...blue.point(675,170));await blue.waitForUnits(2);
    await blue.page.getByRole("button",{name:"Roster",exact:true}).click();
    const panel=blue.page.getByRole("region",{name:"Troops and spells"});
    await panel.getByRole("button",{name:"Spells",exact:true}).click();
    assert.equal(await panel.getByRole("button",{name:"Meteor",exact:true}).isEnabled(),false);
    const fits=await panel.boundingBox(),viewport=blue.page.viewportSize();
    assert.ok(fits.x>=0 && fits.x+fits.width<=viewport.width+1 && fits.y>=0);
    await picture(blue.page,"roster-spells-phone");
    await panel.getByRole("button",{name:"Close roster",exact:true}).click();
    await Promise.all([red,blue].map(p=>p.page.getByRole("button",{name:"Ready",exact:true}).click()));
    await red.page.getByText("Live",{exact:true}).waitFor();
    await selectFromRoster(red.page,"Spells","Meteor");
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
    const frame=blue.frames.at(-1);
    const until=Date.now()+3000;
    while(!red.frames.some(f=>f.revision===frame.revision) && Date.now()<until) await delay(10);
    assert.deepEqual(red.frames.find(f=>f.revision===frame.revision)?.world,frame.world);
    assert.deepEqual(frame.world.units.map(u=>u.kind),["shieldbearer","cyclops"]);
    console.log("Two-client roster and magic: a 390px client bought a Cyclops, saw a cross-field Meteor hit its base, and rejoined the same world.");
  } finally {await Promise.all([red,blue].map(p=>p.page.context().close()));}
}

async function stormDuel(url) {
  const red=await open(url+"/room",1040,620),blue=await open(url+"/room",640,510);
  try {
    await red.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="red");
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue");
    await selectFromRoster(red.page,"Mythical","Storm Kirin");
    await red.page.mouse.click(...red.point(438,165));await red.waitForUnits(1);
    await selectFromRoster(blue.page,"People","Lancer");
    await blue.page.mouse.click(...blue.point(666,165));await blue.waitForUnits(2);
    await selectFromRoster(blue.page,"Machines","Watchpost");
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
    await selectFromRoster(red.page,"People","Miner");
    assert.match(await red.page.locator("#deploy-hint").textContent(),/exit anywhere/);
    await red.page.mouse.click(...red.point(700,245));await red.waitForUnits(1);
    await selectFromRoster(red.page,"Mythical","Witch");await red.page.mouse.click(...red.point(445,132));await red.waitForUnits(2);
    await selectFromRoster(red.page,"Mythical","Zombie");await red.page.mouse.click(...red.point(462,252));await red.waitForUnits(3);
    await blue.page.getByRole("button",{name:"Archer",exact:true}).click();await blue.page.mouse.click(...blue.point(488,252));await blue.waitForUnits(4);
    await selectFromRoster(blue.page,"People","Shieldbearer");await blue.page.mouse.click(...blue.point(516,132));await blue.waitForUnits(5);
    await selectFromRoster(blue.page,"Machines","Watchpost");await blue.page.mouse.click(...blue.point(552,140));
    await Promise.all(players.map(p=>p.waitForUnits(6)));
    const destination=red.frames.at(-1).world.units[0].tunnel;
    assert.deepEqual([destination.toX,destination.toY].map(Math.round),[700,245]);
    await Promise.all(players.map(p=>p.page.getByRole("button",{name:"Ready",exact:true}).click()));
    await blue.page.waitForFunction(()=>document.querySelector("#red-score").title.includes("Hex Pig") && document.querySelector("#red-score").title.includes("Zombie 2"));
    const contact=blue.frames.find(f=>f.world.units[4]?.kind==="pig");
    assert.ok(contact.world.units[0].tunnel && contact.world.units[0].x>destination.fromX);
    assert.equal(contact.world.units[3].zombified.kind,"archer");
    await picture(red.page,"witch-and-zombies");
    await blue.page.reload({waitUntil:"domcontentloaded"});
    await blue.page.waitForFunction(()=>document.querySelector(".game").dataset.team==="blue" && document.querySelector("#red-score").title.includes("Hex Pig"));
    assert.equal(blue.joins[0].resumeToken,blue.joins[1].resumeToken);
    const returned=blue.frames.at(-1),limit=Date.now()+3000;
    while(!red.frames.some(f=>f.revision===returned.revision) && Date.now()<limit)await delay(10);
    assert.deepEqual(red.frames.find(f=>f.revision===returned.revision)?.world,returned.world);
    await selectFromRoster(red.page,"People","Miner");await red.page.mouse.click(...red.point(738,206));
    await Promise.all(players.map(p=>p.waitForUnits(7)));
    assert.ok(blue.frames.at(-1).world.units[6].tunnel.toX>700);
    await red.page.waitForFunction(()=>Number(document.querySelector("#tick").textContent)>210);
    assert.ok(red.frames.some(f=>f.world.units[0]?.emergedTick && !f.world.units[0].tunnel));
    assert.ok(red.frames.some(f=>f.world.units[4]?.unhexedTick && f.world.units[4].team==="blue"));
    console.log("Cross-field Miners, an instantly zombified Archer and a counterattacking Hex Pig agreed across desktop, phone and reconnect.");
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
  await withField(playground);
  await withField(browseRoster);
  await withField(magicDuel);
  await withField(stormDuel);
  await withField(turncoatDuel);
  await withField(url=>match(url,3));
  await withField(url=>match(url,4));
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
