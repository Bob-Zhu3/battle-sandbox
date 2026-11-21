import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { matchDatabase } from "../server/match-database.ts";
import { exchange } from "../server/online-match.ts";
import { CLOSE } from "../src/room-protocol.ts";

function field() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0000_online_rooms.sql",import.meta.url),"utf8"));
  const db = {prepare(sql) {
    const stmt = sqlite.prepare(sql);
    return {bind(...args) {
      const values = args.map(v=>v instanceof ArrayBuffer ? new Uint8Array(v) : v);
      return {async first(){return stmt.get(...values) ?? null;},async run(){return {meta:stmt.run(...values)};}};
    }};
  }};
  let now=10_000;
  return {
    skip(ms){now+=ms;}, db,
    async request(mode,id,input) {
      // A new store on every request also exercises reconnect after a process restart.
      for(let i=0;i<42;i++){
        const reply=await exchange(matchDatabase(db),mode,id,input,()=>now);
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
  assert.equal(ra.events[0].team,"red");assert.equal(rb.events[0].team,"blue");assert.equal(rc.events[0].team,"red");
  assert.equal((await f.request("duel",id,hello(a))).events[0].resumeToken,ra.events[0].resumeToken);
  const stroke=put(205);stroke.action.positions=Array.from({length:5},(_,i)=>({x:205+i*24,y:180}));
  await Promise.all([f.request("duel",id,sync(a,stroke)),f.request("duel",id,sync(b,put(755)))]);
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
