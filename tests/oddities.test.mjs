import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, stepBattle, battleOutcome } from "../src/simulation.ts";
import { makeBase } from "../src/battlefield.ts";
import { placementKind, UNIT_DEFINITIONS as defs } from "../src/units.ts";
import { TRAIL_TICKS } from "../src/trails.ts";
import { maxHealth } from "../src/transformations.ts";
import { Playground } from "../src/playground.ts";
import { Room } from "../server/room.ts";

const at=(id,kind,team,x,y=180)=>({id,kind,team,x,y});
const get=(world,id)=>world.units.find(u=>u.id===id);
const clone=world=>JSON.parse(JSON.stringify(world));
function advance(world,count) { for(let i=0;i<count;i++)world=stepBattle(world);return world; }
function waitFor(world,predicate,limit=300) {
  for(let i=0;i<limit && !predicate(world);i++)world=stepBattle(world);
  assert.ok(predicate(world),"expected encounter by tick "+world.tick);return world;
}
function quiet(world) {for(const u of world.units)u.nextAttackTick=9999;return world;}
const hexShot=(x,y,team="red")=>({kind:"hex",casterId:91,x,y,vx:0,vy:0,releasedTick:0,damage:6,team});
const shot=(x,y,team,damage)=>({kind:"bullet",x,y,vx:0,vy:0,releasedTick:0,damage,team});
const command=(type,x,y)=>({type,positions:[{x,y}]});

test("Miners can buy a tunnel across either kind of match during deployment and battle; retries charge once",()=>{
  for(const mode of ["duel","ffa"]){
    const room=new Room(mode);
    for(let i=0;i<(mode==="duel"?2:3);i++)room.join();
    assert.match(room.place("red",1,1,command("place-warriors",810,250)),/whole stroke/);
    assert.match(room.place("red",1,1,command("place-miners",970,250)),/inside the arena/);
    assert.match(room.place("red",1,1,command("place-pigs",100,90)),/Unknown/);
    assert.equal(placementKind("place-pigs"),undefined);
    const cmd=command("place-miners",810,250);
    assert.equal(room.place("red",1,1,cmd).fresh,true);
    assert.equal(room.place("red",1,1,cmd).fresh,false);
    assert.equal(room.gold.red,101);
    const miner=get(room.world,1),base=room.world.bases[0];
    assert.deepEqual([miner.x,miner.y,miner.tunnel.toX,miner.tunnel.toY],[base.x,base.y,810,250]);
    for(const side of mode==="duel"?["blue"]:["blue","violet"]){
      const home=makeBase(mode,side);
      room.place(side,1,1,command("place-watchposts",home.x,home.y));
      room.control(side,{type:"ready"});
    }
    room.control("red",{type:"ready"});room.advance();assert.equal(room.world.tick,0);
    while(room.phase==="countdown")room.advance();
    for(let i=0;i<32;i++)room.advance();
    assert.ok(get(room.world,1).x>base.x && get(room.world,1).x<810);
    const live=command("place-miners",700,90);
    const ack=room.place("red",1,2,live);assert.equal(ack.fresh,true);
    const id=ack.ack.unitIds[0];assert.equal(get(room.world,id).tunnel.start,room.world.tick+defs.miner.digTicks);
    const saved=clone(room.world);
    for(let i=0;i<25;i++)room.advance();
    assert.deepEqual(advance(saved,25),room.world);
    assert.equal(room.place("red",1,2,live).fresh,false);assert.equal(room.gold.red,82);
  }
});

test("a burrowing Miner passes under troops and shots, then surfaces at the chosen spot before using its pick",()=>{
  let w=quiet(createBattle([at(1,"miner","red",440),at(2,"post","blue",340),at(3,"warrior","blue",459)]));
  const end=get(w,1).tunnel.end;w=advance(w,end-2);
  const miner=get(w,1);assert.equal(get(w,3).targetId,null);
  w.arrows.push(shot(miner.x,miner.y,"blue",12));w=stepBattle(w);
  assert.equal(get(w,1).hp,defs.miner.maxHp);assert.equal(get(w,1).tunnel.toX,440);
  w.arrows=[];w=stepBattle(w);assert.equal(get(w,1).tunnel,undefined);
  assert.deepEqual([get(w,1).x,get(w,1).y,get(w,1).emergedTick],[440,180,end]);
  w=advance(w,defs.miner.emergeTicks-1);assert.equal(get(w,3).hp,defs.warrior.maxHp);
  w=stepBattle(w);assert.equal(get(w,3).hp,defs.warrior.maxHp-7);
});

test("Witch hexes on actual impact, a pig counterattacks its old army, then returns with the same ID and damage",()=>{
  let w=quiet(createBattle([at(1,"witch","red",300),at(2,"engineer","blue",399),at(3,"post","blue",427)]));
  get(w,1).nextAttackTick=1;get(w,2).builtCount=1;get(w,2).hp=19;
  w=stepBattle(w);assert.equal(w.arrows[0].kind,"hex");assert.equal(get(w,2).kind,"engineer");
  w=waitFor(w,s=>!!get(s,2).hex);
  const pig=get(w,2),end=pig.hex.until;
  assert.deepEqual([pig.kind,pig.team,pig.hex.kind,pig.hex.team,pig.hp],["pig","red","engineer","blue",19]);
  w=waitFor(w,s=>get(s,3).hp<defs.post.maxHp);
  assert.equal(get(w,2).targetId,3);
  w.arrows.push(shot(get(w,2).x,get(w,2).y,"blue",4));w=stepBattle(w);
  const saved=clone(w);w=advance(w,end-w.tick);
  const restored=get(w,2);
  assert.deepEqual([restored.kind,restored.team,restored.hp,restored.hex,restored.builtCount],["engineer","blue",15,undefined,1]);
  assert.equal(restored.unhexedTick,end);assert.deepEqual(advance(saved,end-saved.tick),w);
});

test("a pig cannot be repeatedly hexed or farmed by its original army; its caster losing a base frees it",()=>{
  const room=new Room();room.join();room.join();room.phase="running";
  room.world=quiet(createBattle([at(2,"cyclops","blue",400)],0,["red","blue"].map(t=>makeBase("duel",t))));
  room.world.arrows.push(hexShot(400,180));room.advance();
  const pig=get(room.world,2),end=pig.hex.until;
  assert.equal(maxHealth(pig),defs.cyclops.maxHp);assert.equal(pig.hp,defs.cyclops.maxHp);
  room.world.arrows.push(hexShot(pig.x,pig.y,"blue"));room.advance();assert.equal(get(room.world,2).hex.until,end);
  const saved=clone(room.world);
  room.world.arrows.push(shot(get(room.world,2).x,get(room.world,2).y,"blue",200));room.advance();
  assert.equal(room.gold.blue,120);
  saved.bases[0].hp=1;saved.arrows.push(shot(104,180,"blue",12));
  const returned=get(stepBattle(saved),2);assert.equal(returned.kind,"cyclops");assert.equal(returned.team,"blue");
});

test("a lone hexed survivor keeps the playground awake and changes back on the promised tick",()=>{
  const p=new Playground();p.place("blue",command("place-warriors",500,180));
  p.world.arrows.push(hexShot(500,180));p.advance();
  assert.equal(get(p.world,1).kind,"pig");assert.equal(battleOutcome(p.world),null);
  for(let i=0;i<defs.witch.hexTicks;i++)p.advance();
  assert.equal(get(p.world,1).kind,"warrior");assert.equal(get(p.world,1).team,"blue");
});

test("a Clown balloon pops once; a late arrival is poisoned, machines are immune, and enemy Gust disperses the cloud",()=>{
  let w=quiet(createBattle([at(1,"clown","red",300),at(2,"post","blue",390),at(3,"lancer","blue",640),at(4,"post","red",340)]));
  get(w,1).nextAttackTick=1;w=stepBattle(w);
  const land=w.arrows[0].landTick;assert.equal(w.arrows[0].kind,"balloon");
  w=advance(w,land-w.tick-1);assert.equal(get(w,2).hp,defs.post.maxHp);
  w=stepBattle(w);assert.equal(get(w,2).hp,defs.post.maxHp-3);assert.equal(get(w,2).poison,undefined);
  assert.equal(w.effects.filter(e=>e.kind==="miasma").length,1);
  get(w,3).x=394;w=advance(w,10);assert.equal(get(w,3).poison?.team,"red");
  const saved=clone(w);w.spells=[{id:50,kind:"gust",team:"blue",x:390,y:180,startTick:w.tick-7}];
  w=stepBattle(w);assert.equal(w.effects?.some(e=>e.kind==="miasma")??false,false);
  const tail=advance(saved,90);assert.equal(tail.effects?.some(e=>e.kind==="miasma")??false,false);
});

test("the Reaper prefers a wounded living foe and one scythe earns exactly one healing soul",()=>{
  let w=quiet(createBattle([at(1,"reaper","red",402),at(2,"warrior","blue",390),at(3,"archer","blue",439)]));
  get(w,1).hp=17;get(w,1).nextAttackTick=1;get(w,3).hp=6;w=stepBattle(w);
  assert.equal(get(w,1).targetId,3);assert.equal(get(w,3).hp,0);assert.equal(get(w,2).hp,defs.warrior.maxHp);
  assert.equal(get(w,1).hp,25);assert.equal(get(w,1).soul.tick,1);
  w=stepBattle(w);assert.equal(get(w,1).hp,25);
  w=quiet(createBattle([at(1,"reaper","red",400),at(2,"mouse","blue",418)]));
  get(w,1).nextAttackTick=1;get(w,1).hp=17;get(w,2).hp=defs.reaper.damage;w=stepBattle(w);
  assert.equal(get(w,2).hp,0);assert.equal(get(w,1).hp,17);assert.equal(get(w,1).soul,undefined);
});

test("mythical trails follow real turns, stay bounded, fade at rest and replay from a world snapshot",()=>{
  let w=quiet(createBattle([at(1,"frostqueen","red",190),at(2,"phoenix","red",190,220),at(3,"post","blue",720)]));
  w=advance(w,24);const saved=clone(w),original=get(w,1).trail.map(p=>[p.x,p.y]);
  assert.ok(original.length>=2 && original.length<=6);assert.ok(get(w,2).trail.length>=2);
  get(w,3).x=232;get(w,3).y=348;saved.units[2].x=232;saved.units[2].y=348;
  w=advance(w,27);assert.deepEqual(w,advance(saved,27));
  assert.ok(get(w,1).trail.some(p=>p.y>181));
  w.units=w.units.filter(u=>u.id===1);w=advance(w,TRAIL_TICKS+3);assert.equal(get(w,1).trail,undefined);
});

test("simultaneous Zombie bites and a Witch hex choose the same permanent form in either storage order",()=>{
  const setup=[at(1,"zombie","red",388),at(2,"zombie","violet",428),at(3,"lancer","blue",408)];
  for(const group of [setup,[...setup].reverse()]){
    let w=createBattle(group);get(w,3).nextAttackTick=10000;
    w.arrows.push(hexShot(408,180,"amber"));w=stepBattle(w);const z=get(w,3);
    assert.equal(z.team,"red");assert.equal(z.kind,"zombie");assert.equal(z.zombified.kind,"lancer");assert.equal(z.hex,undefined);
  }
});
