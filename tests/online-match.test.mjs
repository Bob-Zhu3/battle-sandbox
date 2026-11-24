import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { matchDatabase } from "../server/match-database.ts";
import { sqliteBinding } from "../scripts/sqlite-binding.mjs";
import { exchange } from "../server/online-match.ts";
import { CLOSE } from "../src/room-protocol.ts";
import { matchLink, matchMode } from "../src/match-link.ts";

test("an invite keeps its game directory and shares only the match ID", () => {
  const home = "https://bob-zhu3.github.io/battle-sandbox/";
  const id = "1234567890abcdef1234";
  for (const [route, mode] of [["room/", "duel"], ["ffa/", "ffa"]]) {
    assert.equal(matchMode(new URL(route, home).pathname), mode);
    assert.equal(matchMode("/" + route.slice(0,-1)), mode);
    assert.equal(matchLink(home + route + "?ids=1&match=" + id + "#field").href, home + route + "?match=" + id);
  }
  assert.equal(matchMode(new URL(home).pathname), undefined);
  assert.equal(matchLink(home + "room/?ids=1").href, home + "room/");
});

function field() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0000_online_rooms.sql",import.meta.url),"utf8"));
  const db = sqliteBinding(sqlite);
  let now=10_000;
  // Saves the database turned away. A race test reads this to prove its requests really collided.
  const saves={rejected:0};
  return {
    skip(ms){now+=ms;}, db, saves,
    async request(mode,id,input) {
      // A new store on every request also exercises reconnect after a process restart.
      for(let i=0;i<42;i++){
        const store=matchDatabase(db);
        const counted={read:store.read,async save(...args){const ok=await store.save(...args);if(!ok)saves.rejected++;return ok;}};
        const reply=await exchange(counted,mode,id,input,()=>now);
        if(!reply.retry)return reply;
      }
      assert.fail("The hosted match failed to catch up.");
    },
  };
}
const hello=(client,resumeToken)=>({op:"join",client,hello:{type:"join",resumeToken}});
const sync=(client,...commands)=>({op:"sync",client,commands});
const put=(x,y=180)=>({round:1,commandId:1,action:{type:"place-warriors",positions:[{x,y}]}});
const ready={round:1,seq:1,action:{type:"ready"}};
const snapshot=r=>r.events.find(e=>e.type==="snapshot");

test("online invites isolate concurrent games, seats and receipts and survive a lost join or purchase confirmation",async()=>{
  const f=field(),a=crypto.randomUUID(),b=crypto.randomUUID(),c=crypto.randomUUID(), id="11111111111111111111", other="22222222222222222222";
  const [ra,rb,rc]=await Promise.all([f.request("duel",id,hello(a)),f.request("duel",id,hello(b)),f.request("duel",other,hello(c))]);
  assert.ok(f.saves.rejected>0,"Both joins found no match yet, so only one of them can create it");
  assert.equal(ra.events[0].team,"red");assert.equal(rb.events[0].team,"blue");assert.equal(rc.events[0].team,"red");
  assert.equal((await f.request("duel",id,hello(a))).events[0].resumeToken,ra.events[0].resumeToken);
  const stroke=put(205);stroke.action.positions=Array.from({length:5},(_,i)=>({x:205+i*24,y:180}));
  const rejected=f.saves.rejected;
  await Promise.all([f.request("duel",id,sync(a,stroke)),f.request("duel",id,sync(b,put(755)))]);
  assert.ok(f.saves.rejected>rejected,"Both purchases read the same version, so the version check must turn one save away");
  assert.equal(snapshot(await f.request("duel",other,sync(c))).world.units.length,0);
  assert.equal((await f.request("duel",other,hello(crypto.randomUUID(),ra.events[0].resumeToken))).close,CLOSE.expired);
  await f.request("duel",id,{op:"disconnect",client:a});
  const fresh=crypto.randomUUID(),returned=await f.request("duel",id,hello(fresh,ra.events[0].resumeToken));
  assert.equal(returned.events[0].team,"red");
  const receipt=await f.request("duel",id,sync(fresh,stroke)), receipt2=await f.request("duel",id,sync(fresh,stroke));
  assert.deepEqual(receipt.events[0],receipt2.events[0]);
  assert.equal(receipt.events[0].unitIds.length,5);
  const world=snapshot(receipt);
  assert.deepEqual(world,snapshot(await f.request("duel",id,sync(b))));
  assert.equal(world.gold.red,60);assert.equal(world.world.units.length,6);
  assert.ok(!JSON.stringify(world).includes(ra.events[0].resumeToken));
  assert.equal((await f.request("duel",id,sync(a,put(315)))).close,CLOSE.replaced);
});

test("a hosted battle advances with all browsers away and both returning players see the same HP, result and seats",async()=>{
  const f=field(),a=crypto.randomUUID(),b=crypto.randomUUID(),id="33333333333333333333";
  const req=input=>f.request("duel",id,input);
  const j1=(await req(hello(a))).events[0],j2=(await req(hello(b))).events[0];
  const rush=put(430,160);
  rush.action.positions=Array.from({length:8},(_,i)=>({x:430,y:100+i*18}));
  await req(sync(a,rush));await req(sync(b,put(520)));await req(sync(a,ready));await req(sync(b,ready));
  f.skip(4200);const contact=snapshot(await req(sync(b)));
  assert.equal(contact.phase,"running");assert.ok(contact.world.tick>0);
  await req({op:"disconnect",client:a});await req({op:"disconnect",client:b});f.skip(24_000);
  const aa=crypto.randomUUID(),bb=crypto.randomUUID();
  await req(hello(aa,j1.resumeToken));await req(hello(bb,j2.resumeToken));
  const second=snapshot(await req(sync(bb))),first=snapshot(await req(sync(aa)));
  assert.deepEqual(first,second);assert.equal(first.phase,"finished");assert.equal(first.outcome,"red");
  assert.ok(first.world.tick>contact.world.tick);assert.equal(first.world.bases[1].hp,0);
});

test("an online free-for-all requires three seats, accepts four and keeps a fifth friend out",async()=>{
  const f=field(), req=input=>f.request("ffa","44444444444444444444",input);
  const clients=Array.from({length:5},()=>crypto.randomUUID());
  for(let i=0;i<4;i++)assert.equal((await req(hello(clients[i]))).events[0].team,["red","blue","violet","amber"][i]);
  assert.equal((await req(hello(clients[4]))).close,CLOSE.full);
  for(let i=0;i<4;i++){
    await req(sync(clients[i],put(i%2?734:220,i<2?110:250)));
    assert.equal(snapshot(await req(sync(clients[i],ready))).phase,i===3?"countdown":"deploy");
  }
  f.skip(3100);const w=snapshot(await req(sync(clients[0])));
  assert.equal(w.phase,"running");assert.equal(w.world.bases.length,4);
});
