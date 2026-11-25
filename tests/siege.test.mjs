import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, stepBattle } from "../src/simulation.ts";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";
import { SPELLS } from "../src/spells.ts";
import { makeBase } from "../src/battlefield.ts";
import { Playground } from "../src/playground.ts";
import { Room } from "../server/room.ts";

const at = (id,kind,team,x,y=180) => ({id,kind,team,x,y});
const get = (world,id) => world.units.find(unit=>unit.id===id);
const copy = world => JSON.parse(JSON.stringify(world));
const cast = (kind,team,x,y,startTick=0,id=90) => ({id,kind,team,x,y,startTick});
const order = (type,x,y) => ({type,positions:[{x,y}]});
function advance(world,ticks) {
  for(let i=0;i<ticks;i++) world=stepBattle(world);
  return world;
}

test("the Stone Lobber shoots over its blind spot, marks a fixed landing place, and splashes ground enemies once",()=>{
  let w=createBattle([at(1,"lobber","red",300), at(2,"post","blue",341), at(3,"post","blue",460),
    at(4,"post","blue",477,195), at(5,"drone","blue",448,193), at(6,"post","red",465,156)]);
  for(const u of w.units.slice(1)) u.nextAttackTick=9999;
  get(w,5).stunnedUntil=9999;
  w=stepBattle(w);
  assert.equal(get(w,1).targetId,3);assert.equal(w.arrows.length,1);
  const rock=w.arrows[0];assert.equal(rock.kind,"stone");assert.equal(get(w,3).hp,defs.post.maxHp);
  get(w,1).hp=0;
  w=advance(w,rock.landTick-w.tick-1);
  assert.equal(get(w,3).hp,defs.post.maxHp);assert.equal(get(w,4).hp,defs.post.maxHp);
  const escaped=copy(w);get(escaped,3).y=243;
  assert.equal(get(stepBattle(escaped),3).hp,defs.post.maxHp);
  w=stepBattle(w);
  assert.equal(w.arrows.length,0);assert.equal(w.effects.at(-1).kind,"stonefall");
  assert.equal(get(w,3).hp,defs.post.maxHp-16);assert.equal(get(w,4).hp,defs.post.maxHp-16);
  for(const id of [2,5,6]) assert.equal(get(w,id).hp,defs[get(w,id).kind].maxHp);
  assert.equal(get(advance(w,10),3).hp,get(w,3).hp);
  const blind=stepBattle(createBattle([at(1,"lobber","red",300),at(2,"belltower","blue",339),at(3,"drone","blue",478)]));
  assert.equal(get(blind,1).targetId,null);assert.equal(blind.arrows.length,0);
});

test("Sun Lens locks through distractions, heats up only on one target and has to refocus after fog or stun",()=>{
  let w=createBattle([at(1,"sunlens","red",300),at(2,"belltower","blue",420)]);
  const hp=defs.belltower.maxHp;
  w=advance(w,12);assert.equal(get(w,2).hp,hp);assert.equal(get(w,1).focusSince,1);
  w.units.push(...createBattle([at(3,"belltower","blue",350,156)],w.tick).units);
  let total=0;
  for(const [tick,damage] of [[13,3],[31,3],[49,6],[67,6],[85,10]]) {
    w=advance(w,tick-w.tick);total+=damage;
    assert.equal(get(w,1).targetId,2);assert.equal(get(w,2).hp,hp-total);
    assert.equal(get(w,1).beam.tick,tick);
  }
  const fromSnapshot=advance(copy(w),14);
  assert.deepEqual(copy(advance(w,14)),copy(fromSnapshot));
  const lost=copy(w);get(lost,2).x=640;
  const switched=stepBattle(lost);assert.equal(get(switched,1).targetId,3);assert.equal(get(switched,1).focusSince,86);
  const struck=copy(w);struck.units.push(...createBattle([at(4,"kirin","blue",398,229)],w.tick).units);
  assert.equal(get(stepBattle(struck),1).focusSince,undefined);
  const friendly=copy(w);friendly.spells=[cast("rain","red",300,180,74)];
  assert.equal(get(stepBattle(friendly),1).focusSince,1);
  w.spells=[cast("rain","blue",300,180,74)];
  w=stepBattle(w);assert.equal(get(w,1).fogUntil,113);assert.equal(get(w,1).targetId,null);
  w=advance(w,26);assert.equal(get(w,2).hp,hp-total);
  w=stepBattle(w);assert.equal(get(w,1).focusSince,113);assert.equal(get(w,1).targetId,3);
  w=advance(w,8);assert.equal(get(w,3).hp,hp);
  w=stepBattle(w);assert.equal(get(w,1).focusSince,undefined); // The second shower arrives before the lens fires.
});

test("a quiet playground wakes its Sun Lens after the final rain pulse",()=>{
  const p=new Playground();
  p.place("red",order(defs.sunlens.command,300,180));
  p.place("blue",order(defs.belltower.command,430,180));
  p.cast("blue","rain",300,180);
  for(let i=0;i<124;i++)p.advance();
  assert.equal(get(p.world,1).focusSince,111);assert.equal(get(p.world,1).beam.tick,123);
});

test("a Bell Tower cancels a charge on its contact tick, moves grounded enemies and leaves flyers and buildings alone",()=>{
  let w=createBattle([at(1,"belltower","blue",350),at(2,"lancer","red",321),
    at(3,"warrior","red",350,219),at(4,"post","red",350,131),at(5,"drone","red",397),at(6,"warrior","blue",300,201)]);
  get(w,2).runUp=60;
  for(const id of [3,4,5,6])get(w,id).nextAttackTick=9999;
  w=stepBattle(w);
  assert.equal(get(w,1).hp,defs.belltower.maxHp);assert.equal(get(w,1).nextAttackTick,91);
  for(const id of [2,3]) {
    const u=get(w,id);assert.equal(u.hp,defs[u.kind].maxHp-4);assert.equal(u.stunnedUntil,11);
  }
  assert.equal(get(w,2).lastChargeTick,undefined);assert.equal(get(w,2).runUp,0);
  for(const id of [4,5,6])assert.equal(get(w,id).stunnedUntil,undefined);
  const sx=get(w,2).x;w=advance(w,7);
  assert.ok(get(w,2).x<sx-20);assert.equal(get(w,1).x,350);assert.equal(get(w,1).lastAttackTick,1);
});

test("both fault pulses crack buildings and bases, miss flyers, and bring a traveling Miner up at the dirt trail",()=>{
  const base=makeBase("duel","blue");base.x=320;base.y=235;base.stunnedUntil=9999;
  let w=createBattle([at(1,"miner","red",800),at(2,"post","red",291,211),at(3,"drone","red",300,150),
    at(4,"belltower","blue",345,182)],0,[base]);
  get(w,3).stunnedUntil=9999;get(w,2).nextAttackTick=9999;get(w,4).nextAttackTick=9999;
  while(get(w,1).x<261)w=stepBattle(w);
  const where=get(w,1).x;
  w.spells=[cast("fault","blue",where,180,w.tick-15),cast("fault","red",320,235,w.tick-15,91)];
  w=stepBattle(w);
  const miner=get(w,1);
  assert.equal(miner.tunnel,undefined);assert.equal(miner.x,where);
  assert.equal(miner.emergedTick,w.tick);assert.ok(miner.nextAttackTick>=w.tick+defs.miner.emergeTicks);
  assert.equal(miner.hp,defs.miner.maxHp-3);
  assert.equal(get(w,2).hp,defs.post.maxHp-12);assert.equal(get(w,3).hp,defs.drone.maxHp);
  assert.equal(get(w,4).hp,defs.belltower.maxHp-12);assert.equal(w.bases[0].hp,base.hp-3);
  w=advance(w,28);
  assert.equal(get(w,2).hp,defs.post.maxHp-24);assert.equal(w.bases[0].hp,base.hp-6);
});

test("Vines holds feet but admits late arrivals, lets an Archer shoot, and unravels on a Phoenix hit",()=>{
  let w=createBattle([at(1,"lancer","blue",365),at(2,"archer","blue",365,145),at(3,"drone","blue",376,216),
    at(4,"warrior","red",465),at(5,"belltower","blue",334,158)]);
  w.spells=[cast("briar","red",365,177,-13)];get(w,1).runUp=55;
  w=stepBattle(w);
  assert.equal(get(w,1).rootedUntil,79);assert.equal(get(w,1).x,365);assert.equal(get(w,1).runUp,0);
  assert.ok(w.arrows.some(s=>s.casterId===2));assert.equal(get(w,2).rootedUntil,79);
  for(const id of [3,4,5])assert.equal(get(w,id).rootedUntil,undefined);
  w.units.push(...createBattle([at(6,"warrior","blue",390,166)],w.tick).units);
  w=stepBattle(w);assert.equal(get(w,6).rootedUntil,undefined);
  const expired=createBattle([at(1,"lancer","blue",365),at(2,"belltower","red",509)]);
  expired.spells=[cast("briar","red",365,180,-13)];
  const held=advance(expired,78);assert.equal(get(held,1).x,365);
  assert.ok(get(stepBattle(held),1).x>365);
  w.units.push(...createBattle([at(7,"phoenix","red",342,188)],w.tick).units);
  w=stepBattle(w);assert.ok(get(w,1).burn);assert.equal(get(w,1).rootedUntil,undefined);
});

const bolt = (casterId,x,y=180,kind="dart") => ({kind,casterId,x,y,vx:-10,vy:0,damage:6,team:"blue",releasedTick:0});
test("a Mirror Ward turns an incoming bolt at the pane, then it can hit its own Watchpost on a later tick",()=>{
  let w=createBattle([at(1,"belltower","red",300),at(2,"post","blue",370)]);
  get(w,2).nextAttackTick=9999;w.spells=[cast("mirror","red",300,180,-5)];w.arrows=[bolt(2,350)];
  const before=w, saved=copy(w);w=stepBattle(w);
  const returned=w.arrows[0];
  assert.deepEqual([returned.team,returned.x,returned.vx,returned.reflectedTick],["red",346,10,1]);
  assert.deepEqual(w.spells[0].reflection,{count:1,tick:1,x:346,y:180});assert.deepEqual(copy(before),saved);
  assert.equal(get(w,2).hp,defs.post.maxHp);
  assert.deepEqual(copy(advance(copy(w),6)),copy(advance(w,6)));
  w=advance(w,6);assert.equal(get(w,2).hp,defs.post.maxHp-6);assert.equal(w.arrows.length,0);
  assert.equal(get(w,1).hp,defs.belltower.maxHp);
});

test("only three eligible shots entering the rim are returned, in crossing order; a closer body still intercepts",()=>{
  const incoming=[bolt(4,355),bolt(3,353),bolt(2,352),bolt(1,351),bolt(5,351,180,"bullet"),
    bolt(6,340),{...bolt(7,352),reflectedTick:0},bolt(8,351,180,"ice")];
  function resolve(shots) {
    const w=createBattle([]);w.spells=[cast("mirror","red",300,180,-5)];w.arrows=shots;return stepBattle(w);
  }
  for(const shots of [incoming,[...incoming].reverse()]) {
    const w=resolve(shots);assert.equal(w.spells[0].reflection.count,3);
    assert.deepEqual(w.arrows.filter(s=>s.team==="blue").map(s=>s.casterId).sort(),[4,5,6,7,8]);
  }
  const w=createBattle([at(1,"belltower","red",362)]);
  w.spells=[cast("mirror","red",300,180,-5)];w.arrows=[{...bolt(12,386),vx:-65}];
  const next=stepBattle(w);assert.equal(next.spells[0].reflection,undefined);assert.equal(get(next,1).hp,defs.belltower.maxHp-6);
});

test("all three towers and spells use normal camp, gold and retry rules in both multiplayer modes",()=>{
  for(const mode of ["duel","ffa"]) {
    const room=new Room(mode),teams=mode==="duel"?["red","blue"]:["red","blue","violet"];
    for(const team of teams)room.join();
    let id=1;
    for(const kind of ["lobber","sunlens","belltower"]) {
      assert.match(room.place("red",1,id,order(defs[kind].command,900,280)),/whole stroke/);
      const cmd=order(defs[kind].command,100+id*37,90);
      assert.ok(room.place("red",1,id,cmd).fresh);assert.equal(room.place("red",1,id++,cmd).fresh,false);
    }
    assert.equal(room.gold.red,50);
    for(const kind of ["fault","briar","mirror"])
      assert.match(room.place("red",1,id,order(SPELLS[kind].command,844,250)),/unlock/);
    for(const team of teams.slice(1)) {const home=makeBase(mode,team);room.place(team,1,1,order(defs.post.command,home.x,home.y));}
    for(const team of teams)room.control(team,{type:"ready"});
    while(room.phase!=="running")room.advance();
    for(const kind of ["fault","briar","mirror"]) {
      const cmd=order(SPELLS[kind].command,844,250),first=room.place("red",1,id,cmd);
      assert.ok(first.fresh);assert.equal(room.place("red",1,id++,cmd).ack.spellId,first.ack.spellId);
    }
    assert.equal(room.gold.red,5);assert.equal(room.world.spells.length,3);
    assert.match(room.place("red",1,id,order(SPELLS.briar.command,844,250)),/13 gold/);
    const resumed=copy(room.world);
    for(let i=0;i<55;i++)room.advance();
    assert.deepEqual(copy(room.world),copy(advance(resumed,55)));
  }
});
