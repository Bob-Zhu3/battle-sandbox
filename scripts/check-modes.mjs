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
  await withField(url=>match(url,3));
  await withField(url=>match(url,4));
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
