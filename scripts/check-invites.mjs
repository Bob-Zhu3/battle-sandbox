import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";
import { createGameServer } from "../server/http.ts";

const args=process.argv.slice(2),remote=args.find(a=>!a.startsWith("--"));
const server=remote?null:createGameServer();
if(server){server.http.listen(0,"127.0.0.1");await once(server.http,"listening");}
const home=new URL(remote ?? "http://127.0.0.1:"+server.http.address().port);
const browser=await chromium.launch({channel:existsSync(chromium.executablePath())?undefined:"chrome"});
const sessions=[],errors=[];
async function player(width,height) {
  const ctx=await browser.newContext({viewport:{width,height},permissions:["clipboard-read","clipboard-write"]});
  if(args.includes("--http"))await ctx.routeWebSocket(/\/(room|ffa)\/socket/,ws=>ws.close({code:1013,reason:"Testing HTTPS fallback"}));
  const page=await ctx.newPage(), frames=[], joins=[], transports=new Set();
  function observe(e,wire){
    if(e.type==="snapshot"){frames.push(e);transports.add(wire);}
    if(e.type==="joined")joins.push(e);
  }
  page.on("pageerror",e=>errors.push(e.message));
  page.on("websocket",ws=>ws.on("framereceived",({payload})=>{try{observe(JSON.parse(String(payload)),"WebSocket");}catch{}}));
  page.on("response",async r=>{
    if(!r.url().includes("/api/matches/")||!r.ok())return;
    try{const packet=await r.json();for(const e of packet.events??[])observe(e,"HTTPS");}catch{/* Page may reload after a response. */}
  });
  const seat={ctx,page,frames,joins,transports};sessions.push(seat);return seat;
}
async function wait(check,why,ms=20000) {
  const end=Date.now()+ms;while(!check() && Date.now()<end)await sleep(35);
  assert.ok(check(),why);
}
const side=(p,team)=>p.page.waitForFunction(t=>document.querySelector(".game")?.dataset.team===t,team,{timeout:25000});
async function create(p,name) {
  await p.page.goto(home.href);await p.page.locator("#demo-picker summary").click();
  await p.page.getByRole("link",{name:new RegExp("^"+name)}).click();
  await side(p,"red");await p.page.getByRole("button",{name:"Copy invite"}).click();
  const manual=p.page.locator("#invite-url");
  const link=await manual.isVisible()?await manual.inputValue():await p.page.evaluate(()=>navigator.clipboard.readText());
  assert.match(link,/\?match=[a-f0-9]{20}$/);assert.equal(link,p.page.url());
  const invite=new URL(link);
  assert.equal(invite.origin,home.origin);
  assert.equal(invite.pathname,new URL(name==="Duel"?"room/":"ffa/",home).pathname);
  return link;
}
async function draw(p,x,y,ey=y) {
  // The team is assigned before the first world snapshot enables deployment.
  await p.page.locator("#brush-tool").waitFor({state:"visible"});
  const box=await p.page.locator("#arena").boundingBox();
  const px=box.x+x*box.width/960,py=v=>box.y+v*box.height/360;
  await p.page.mouse.move(px,py(y));await p.page.mouse.down();
  if(y!==ey)await p.page.mouse.move(px,py(ey),{steps:12});
  await p.page.mouse.up();
}
const ready=p=>p.page.getByRole("button",{name:"Ready",exact:true}).click();
try{
  const red=await player(1024,640),blue=await player(390,700),other=await player(820,620);
  const link=await create(red,"Duel");
  await blue.page.goto(link);await side(blue,"blue");
  const separate=await create(other,"Duel");assert.notEqual(link,separate);
  await Promise.all([draw(red,458,98,243),draw(blue,502,170)]);
  await wait(()=>[red,blue].every(p=>p.frames.some(f=>f.world.units.length===8)),"both screens receive all eight troops");
  const formation=p=>p.frames.find(f=>f.world.units.length===8).world.units.map(({id,team,x,y})=>[id,team,x,y]);
  assert.deepEqual(formation(red),formation(blue));assert.equal(other.frames.at(-1).world.units.length,0);
  await other.page.getByRole("link",{name:"Leave match"}).click();
  await other.page.waitForURL(home.href);
  await Promise.all([ready(red),ready(blue)]);
  await wait(()=>blue.frames.some(f=>f.world.units.some(u=>u.lastHitTick!=null)),"first hit in the public match",30000);
  const oldToken=blue.joins.at(-1).resumeToken;
  await blue.page.reload();await side(blue,"blue");
  await wait(()=>blue.joins.length>=2,"rejoined the same seat");assert.equal(blue.joins.at(-1).resumeToken,oldToken);
  await wait(()=>[red,blue].every(p=>p.frames.some(f=>f.phase==="finished")),"both browsers receive the final result",45000);
  const final=p=>p.frames.find(f=>f.phase==="finished");
  assert.equal(final(red).outcome,"red");assert.deepEqual(final(red).world,final(blue).world);
  console.log("Duel: two viewport sizes copied and opened the same invite; an independent room stayed empty. Blue rejoined after damage. Both saw Red win on tick",final(red).world.tick,"via",[...new Set([...red.transports,...blue.transports])].join(" / ")+".");
  if(!args.includes("--duel-only")){
    const group=[await player(1000,640),await player(430,690),await player(760,600)];
    const ffa=await create(group[0],"Free-for-all");
    for(const [i,team] of ["blue","violet"].entries()){await group[i+1].page.goto(ffa);await side(group[i+1],team);}
    await Promise.all([draw(group[0],300,109),draw(group[1],640,109),draw(group[2],300,205)]);
    await wait(()=>group.every(p=>p.frames.at(-1)?.world.units.length===3),"all three armies deployed");
    await Promise.all(group.map(ready));
    await wait(()=>group.every(p=>p.frames.some(f=>f.phase==="running" && f.world.bases.length===3)),"free-for-all countdown completed");
    console.log("Free-for-all: three independent browsers joined one invite, deployed in different camps and started the same three-base battle.");
  }
  assert.deepEqual(errors,[]);
} finally {
  await Promise.all(sessions.map(async p=>{try {if(await p.page.locator("#room-leave").isVisible())await p.page.locator("#room-leave").click({timeout:3000});}catch{} }));
  await browser.close();
  if(server){server.closeRoom();await new Promise(resolve=>server.http.close(resolve));}
}
