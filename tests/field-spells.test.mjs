import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, stepBattle } from "../src/simulation.ts";
import { makeBase } from "../src/battlefield.ts";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";
import { SPELLS } from "../src/spells.ts";
import { Room } from "../server/room.ts";

const at=(id,kind,team,x,y=180)=>({id,kind,team,x,y});
const unit=(w,id)=>w.units.find(u=>u.id===id);
const json=w=>JSON.parse(JSON.stringify(w));
const spell=(kind,team,x,y=180,startTick=1-SPELLS[kind].delay,id=50)=>({id,kind,team,x,y,startTick});
function advance(w,n){for(let i=0;i<n;i++)w=stepBattle(w);return w;}

test("Freeze catches a charge and a Kirin before either can strike; shots already released still hit",()=>{
  let w=createBattle([at(1,"post","red",310),at(2,"lancer","blue",343),at(3,"kirin","blue",357,205)]);
  unit(w,1).nextAttackTick=9999;unit(w,2).runUp=60;
  w.arrows=[{kind:"dart",casterId:78,team:"blue",x:330,y:180,vx:-13,vy:0,damage:6,releasedTick:0}];
  w.spells=[spell("freeze","red",350)];const before=json(w),original=w;
  w=stepBattle(w);assert.deepEqual(json(original),before);
  assert.equal(unit(w,2).runUp,0);assert.equal(unit(w,2).lastChargeTick,undefined);
  assert.equal(unit(w,3).arc,undefined);assert.equal(unit(w,1).hp,defs.post.maxHp-6);
  const frozen=unit(w,2);assert.equal(frozen.frozenAt,1);assert.equal(frozen.frozenUntil,67);
  const resumed=json(w);w=advance(w,65);assert.equal(unit(w,2).x,frozen.x);assert.equal(unit(w,2).lastAttackTick,null);
  assert.deepEqual(json(advance(resumed,65)),json(w));
  w=stepBattle(w);assert.equal(unit(w,2).frozenUntil,undefined);assert.equal(unit(w,3).arc.tick,67);
});

test("a Gust can slide a frozen Lancer without changing its stride or rebuilding its charge",()=>{
  let w=advance(createBattle([at(1,"post","red",760),at(2,"lancer","blue",430)]),12);
  const runner=unit(w,2), start=w.tick;
  w.spells=[spell("freeze","red",runner.x,180,start+1-SPELLS.freeze.delay),
    spell("gust","red",runner.x-18,180,start,51)];
  w=advance(w,8);
  const ice=unit(w,2);
  assert.ok(ice.x>runner.x+20 && ice.frozenUntil>w.tick);
  assert.equal(ice.runUp,0);assert.equal(ice.walkDistance,runner.walkDistance);assert.equal(ice.pace,runner.pace);
});

test("Freeze puts out an existing burn, a Phoenix strike melts ice, and a simultaneous lightning stun survives thaw",()=>{
  const w=createBattle([at(1,"phoenix","red",313),at(2,"lancer","blue",344),at(3,"archer","blue",382,162)]);
  unit(w,3).burn={team:"red",applied:0,next:1,until:40};
  w.spells=[spell("freeze","red",350),spell("lightning","red",350,180,-17,51)];
  const n=stepBattle(w);
  assert.equal(unit(n,2).frozenUntil,undefined);assert.equal(unit(n,2).burn.team,"red");
  assert.equal(unit(n,2).stunnedUntil,16);assert.equal(unit(n,2).lastAttackTick,null);
  assert.equal(unit(n,3).frozenUntil,67);assert.equal(unit(n,3).burn,undefined);
  assert.equal(unit(n,3).hp,defs.archer.maxHp-SPELLS.lightning.damage);
});

test("lightning chooses distinct exposed enemies by current HP, then distance and stable ID, and retains the impact points",()=>{
  const placements=[at(11,"lancer","blue",385),at(9,"warrior","blue",353),at(6,"warrior","violet",327),
    at(7,"warrior","blue",390),at(4,"cyclops","red",343,146),at(2,"miner","blue",386)];
  const base=makeBase("duel","blue");base.x=344;base.y=219;
  for(const order of [placements,[...placements].reverse()]){
    let w=createBattle(order,0,[{...base}]);
    for(const u of w.units)u.nextAttackTick=9999;
    const miner=unit(w,2);miner.x=340;miner.y=180;miner.hp=145;
    unit(w,11).hp=40;unit(w,7).hp=39;w.spells=[spell("lightning","red",340)];
    const initial=w;w=stepBattle(w);
    const arcs=w.spells[0].strikes;
    assert.deepEqual(arcs.map(a=>a.id),[base.id,6,9]);
    assert.deepEqual(arcs[1],{id:6,x:327,y:180});
    assert.equal(initial.spells[0].strikes,undefined);assert.equal(initial.bases[0].hp,160);
    assert.equal(w.bases[0].hp,154);assert.equal(w.bases[0].stunnedUntil,16);
    assert.equal(unit(w,11).hp,40);assert.equal(unit(w,2).hp,145);assert.equal(unit(w,4).hp,defs.cyclops.maxHp);
    const roundTrip=json(w);w=advance(w,8);assert.deepEqual(w.spells[0].strikes,arcs);assert.deepEqual(json(advance(roundTrip,8)),json(w));
  }
});

test("bases freeze for half the duration, and a lightning bolt into empty ground finds no targets",()=>{
  const base=makeBase("duel","blue");base.x=330;
  let w=createBattle([at(1,"post","red",260)],0,[base]);unit(w,1).nextAttackTick=9999;
  w.spells=[spell("freeze","red",330),spell("lightning","red",911,20,-17,51)];
  w=stepBattle(w);assert.equal(w.bases[0].frozenUntil,34);assert.deepEqual(w.spells[1].strikes,[]);
  w=advance(w,32);assert.equal(w.bases[0].targetId,null);
  w=stepBattle(w);assert.equal(w.bases[0].targetId,1);assert.equal(w.bases[0].acquiredTick,34);
});

test("Rage speeds travel and remaining attack recovery inside the ring, including new arrivals; overlapping rings do not stack",()=>{
  const make=()=>createBattle([at(1,"warrior","red",300),at(2,"post","blue",650),at(3,"post","red",330,151),at(4,"archer","blue",356)]);
  const one=make();unit(one,4).stunnedUntil=9999;unit(one,2).nextAttackTick=9999;
  one.spells=[spell("rage","red",300)];
  const two=json(one);two.spells.push(spell("rage","red",300,180,-7,51));
  let a=stepBattle(one),b=stepBattle(two);
  assert.ok(Math.abs(unit(a,1).x-302.1)<1e-8);assert.equal(unit(a,1).raging,true);
  assert.equal(unit(a,3).raging,undefined);assert.equal(unit(a,4).raging,undefined);
  assert.deepEqual(json(a.units),json(b.units));
  a.units.push(...createBattle([at(7,"lancer","red",322)],a.tick).units);
  a=stepBattle(a);assert.equal(unit(a,7).raging,true);
  unit(a,1).x=415;const x=unit(a,1).x;a=stepBattle(a);
  assert.equal(unit(a,1).raging,undefined);assert.equal(x-unit(a,1).x,1.5);
  let fight=createBattle([at(1,"warrior","red",300),at(2,"belltower","blue",333)]);
  unit(fight,2).nextAttackTick=9999;fight.spells=[spell("rage","red",300)];
  const times=[];for(let t=1;t<=43;t++){fight=stepBattle(fight);if(unit(fight,1).lastAttackTick===t)times.push(t);}
  assert.deepEqual(times,[1,21,41]);assert.equal(unit(fight,2).hp,defs.belltower.maxHp-30);
  fight.spells=[];fight=stepBattle(fight);assert.equal(unit(fight,1).raging,undefined);
  b=advance(b,155);assert.ok(b.units.every(u=>!u.raging));
});

test("all three spells unlock live, cast outside camp, receipt exactly once and retain their state for a resumed player",()=>{
  for(const mode of ["duel","ffa"]){
    const room=new Room(mode),sides=mode==="duel"?["red","blue"]:["red","blue","violet"];
    const seats=sides.map(()=>room.join());
    for(const side of sides){
      const home=makeBase(mode,side);room.place(side,1,1,{type:defs.post.command,positions:[{x:home.x,y:home.y}]});
    }
    const enemy=makeBase(mode,"blue"),dest=[{x:enemy.x,y:enemy.y}];
    for(const kind of ["freeze","lightning","rage"]) assert.match(room.place("red",1,2,{type:SPELLS[kind].command,positions:dest}),/unlock/);
    for(const side of sides)room.control(side,{type:"ready"});
    while(room.phase!=="running")room.advance();
    let id=2;
    for(const kind of ["freeze","lightning","rage"]){
      const cmd={type:SPELLS[kind].command,positions:dest};const a=room.place("red",1,id,cmd);assert.equal(a.fresh,true);
      assert.deepEqual(room.place("red",1,id++,cmd),{ack:a.ack,fresh:false});
    }
    assert.equal(room.gold.red,49);room.disconnect("blue");
    for(let i=0;i<21;i++)room.advance();
    assert.equal(room.join(seats[1].resumeToken).team,"blue");
    const saved=json(room.snapshot(1).world);assert.ok(saved.spells.find(s=>s.kind==="lightning").strikes.length);
    assert.ok(saved.units.find(u=>u.team==="blue").frozenUntil>saved.tick);
    for(let i=0;i<25;i++)room.advance();
    assert.deepEqual(json(advance(saved,25)),json(room.world));
  }
});
