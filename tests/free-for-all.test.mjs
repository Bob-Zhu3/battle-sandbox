import assert from "node:assert/strict";
import test from "node:test";
import { Room } from "../server/room.ts";
import { STARTING_GOLD, TEAMS, inCamp } from "../src/battlefield.ts";
import { battleOutcome, createBattle, stepBattle } from "../src/simulation.ts";

const camp = { red: [445,155], blue: [525,153], violet: [450,215], amber: [543,220] };
const order = (team, n = 1, archer = false) => ({
  type: archer ? "place-archers" : "place-warriors",
  positions: Array.from({length:n}, (_,i)=>({ x:camp[team][0], y:camp[team][1]+i })),
});

test("the treasury prices whole strokes, rejects overspending and refunds exactly once", () => {
  const room = new Room("ffa");
  const red = room.join(); room.join();
  const mixed = {type:"place-archers", positions:[{x:450,y:174},{x:450,y:184}]};
  assert.equal(room.gold.red, STARTING_GOLD);
  assert.match(room.place("red",1,1,mixed), /camp/);
  const five = order("red",5);
  const receipt = room.place("red",1,1,five).ack;
  assert.deepEqual(receipt.unitIds, [1,2,3,4,5]);
  assert.equal(room.gold.red,60);
  room.disconnect("red");
  assert.deepEqual(room.join(red.resumeToken),red);
  assert.deepEqual(room.place("red",1,1,five),{ack:receipt,fresh:false});
  assert.equal(room.gold.red,60);
  assert.match(room.place("red",1,2,order("red",8,true)),/64 gold/);
  assert.equal(room.world.units.length,5);
  assert.ok(room.place("blue",1,1,order("blue",2,true)).fresh);
  assert.ok(room.place("red",1,2,order("red",7,true)).fresh);
  assert.equal(room.gold.red,4);
  room.control("red",{type:"undo"});
  assert.equal(room.gold.red,60);
  room.control("red",{type:"clear"});
  assert.deepEqual([room.gold.red,room.gold.blue], [120,104]);
  room.place("red",1,1,five);
  assert.deepEqual([room.gold.red, room.world.units.length],[120,2]);
});

for (const size of [3,4]) {
  test(size+" players deploy in stable camps and need every occupied seat ready", () => {
    const room = new Room("ffa"), roster = TEAMS.slice(0,size);
    for (const team of roster) {
      assert.equal(room.join().team,team);
      assert.equal(room.gold[team],120);
      const stamp = order(team);
      assert.ok(room.place(team,1,1,stamp).fresh);
      assert.equal(room.gold[team],108);
    }
    for (const team of roster.slice(0,-1)) room.control(team,{type:"ready"});
    assert.equal(room.phase,"deploy");
    room.control(roster.at(-1),{type:"ready"});
    assert.equal(room.phase,"countdown");
    for(let i=0;i<180;i++) room.advance();
    assert.equal(room.phase,"running");
    assert.equal(room.join(),undefined,"a late player cannot occupy the empty corner mid-fight");
    room.advance(); const tick=room.world.tick;
    room.leave("red"); room.advance();
    assert.equal(room.world.tick,tick+1,"a departure must not reset everyone else's battle");
    const owner=roster.at(-1);
    assert.ok(room.place(owner,1,2,order(owner,7)).fresh);
    while(room.phase==="running" && room.world.tick<2600) room.advance();
    assert.equal(room.phase,"finished");
    assert.deepEqual([...new Set(room.world.units.map(u=>u.team))],roster);
    assert.ok(room.world.bases.filter(b=>b.hp>0).length<=1);
    room.control("blue",{type:"new-round"});
    assert.equal(room.phase,"deploy");
    assert.equal(room.world.units.length,0);
    assert.ok(Object.values(room.gold).every(amount => amount===120));
  });
}

test("two ready armies wait for a third; a reserved seat can rejoin and release a ready match", () => {
  const room = new Room("ffa");
  const red=room.join(); room.join();
  for(const team of ["red","blue"]) { room.place(team,1,1,order(team)); room.control(team,{type:"ready"}); }
  assert.equal(room.phase,"deploy");
  room.disconnect("red");
  room.join(); room.place("violet",1,1,order("violet")); room.control("violet",{type:"ready"});
  assert.equal(room.phase,"deploy");
  room.join(red.resumeToken);
  assert.equal(room.phase,"countdown");
});

test("seams have one owner and any surviving color must outlast hostile arrows", () => {
  for (const [x,y,team] of [[0,0,"red"],[480,0,"blue"],[0,180,"violet"],[480,180,"amber"],[960,360,"amber"]]) {
    assert.deepEqual(TEAMS.filter(t=>inCamp("ffa",t,x,y)),[team]);
  }
  let world = createBattle([{id:1,team:"violet",x:350,y:200},{id:2,team:"amber",x:380,y:200}]);
  assert.equal(battleOutcome(world),null);
  world.units[0].hp=10; world=stepBattle(world);
  assert.equal(battleOutcome(world),"amber");
  world.arrows.push({x:45,y:45,vx:5,vy:0,team:"blue",releasedTick:1,damage:8});
  assert.equal(battleOutcome(world),null);
});
