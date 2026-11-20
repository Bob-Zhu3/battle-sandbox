import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, stepBattle, battleOutcome } from "../src/simulation.ts";
import { makeBase } from "../src/battlefield.ts";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";
import { Playground } from "../src/playground.ts";
import { Room } from "../server/room.ts";

const at = (id, kind, team, x, y=170) => ({id,kind,team,x,y});
const get = (world,id) => world.units.find(u=>u.id===id);
function advance(world,count) {
  for(let i=0;i<count;i++) world=stepBattle(world);
  return world;
}
function waitFor(world,check,limit=300) {
  for(let i=0;i<limit && !check(world);i++) world=stepBattle(world);
  assert.ok(check(world),"missing event at tick "+world.tick);
  return world;
}
const shot=(kind,team,x,y,vx,damage)=>({kind,team,x,y,vx,vy:0,damage,releasedTick:0});
function quiet(world) {for(const u of world.units)u.nextAttackTick=10000;return world;}

test("each of four lightning contacts stuns; a chained Lancer loses its charge even on the contact tick",()=>{
  const group=[at(1,"kirin","red",285),at(7,"warrior","red",420),
    at(2,"post","blue",345),at(3,"lancer","blue",394),at(4,"warrior","blue",450),at(5,"archer","blue",507),at(6,"archer","blue",575)];
  for(const order of [group,[...group].reverse()]) {
    let world=quiet(createBattle(order));
    get(world,1).nextAttackTick=get(world,3).nextAttackTick=1;get(world,3).runUp=60;
    world=stepBattle(world);
    assert.deepEqual(get(world,1).arc.path.map(p=>p.x),[285,345,394,450,507]);
    for(const [id,damage] of [[2,9],[3,7],[4,5],[5,3]]) {
      assert.equal(get(world,id).stunnedUntil,1+defs.kirin.stunTicks);
      assert.equal(get(world,id).hp,defs[get(world,id).kind].maxHp-damage);
    }
    assert.equal(get(world,6).stunnedUntil,undefined);assert.equal(get(world,7).hp,30);
    assert.equal(get(world,3).lastChargeTick,undefined);assert.equal(get(world,3).runUp,0);
    const x=get(world,3).x;world=advance(world,defs.kirin.stunTicks-1);
    assert.equal(get(world,3).x,x);assert.equal(get(world,3).runUp,0);
    world=stepBattle(world);assert.equal(get(world,7).hp,23);
  }
});

test("a lightning strike on the last wind-up tick cancels a Cyclops slam; a nearby Clockmouse can also interrupt",()=>{
  for(const attacker of ["kirin","mouse"]){
    let world=createBattle([at(1,"cyclops","red",400),at(2,"post","blue",445)]);
    get(world,2).nextAttackTick=10000;
    world=advance(world,defs.cyclops.windup);assert.equal(get(world,1).windup.kind,"smash");
    world.units.push(...createBattle([at(3,attacker,attacker==="kirin"?"blue":"red",attacker==="kirin"?322:401)]).units);
    world=stepBattle(world);
    assert.equal(get(world,1).windup,undefined);assert.ok(get(world,1).stunnedUntil>world.tick);
    assert.equal(get(world,1).lastSmashTick,undefined);assert.equal(get(world,2).hp,37);
    if(attacker==="mouse")assert.equal(get(world,3).lastSqueakTick,world.tick);
  }
});

test("a club hits its marked patch once, stuns and shoves both enemies while an ally and a distant target are spared",()=>{
  let world=quiet(createBattle([at(1,"cyclops","red",410),at(2,"warrior","blue",448),
    at(3,"lancer","blue",462,194),at(4,"archer","red",450,195),at(5,"post","blue",585)]));
  get(world,1).nextAttackTick=1;
  world=advance(world,defs.cyclops.windup);assert.equal(get(world,2).hp,30);
  get(world,3).runUp=60;
  const before=get(world,2).x;
  world=stepBattle(world);const t=world.tick;
  assert.equal(world.effects.filter(e=>e.kind==="smash").length,1);
  for(const [id,hp] of [[2,14],[3,10],[4,20],[5,37]])assert.equal(get(world,id).hp,hp);
  assert.equal(get(world,3).runUp,0);assert.equal(get(world,3).stunnedUntil,t+defs.cyclops.stunTicks);
  world=advance(world,7);assert.ok(get(world,2).x-before>30);assert.equal(get(world,2).hp,14);
});

test("a ground stun takes priority over a charged thrust on its contact tick in either storage order",()=>{
  const group=[at(1,"cyclops","red",398),at(2,"lancer","blue",438),at(3,"medic","red",464)];
  for(const order of [group,[...group].reverse()]){
    let w=quiet(createBattle(order));w.tick=defs.cyclops.windup;
    get(w,1).windup={kind:"smash",since:1,x:428,y:170,targetId:2};
    const lance=get(w,2);lance.aimX=1;lance.runUp=60;lance.nextAttackTick=1;
    w=stepBattle(w);
    assert.equal(get(w,2).runUp,0);assert.equal(get(w,2).lastAttackTick,null);
    assert.equal(get(w,3).hp,defs.medic.maxHp);assert.ok(get(w,2).knockback);
  }
});

test("a stunned Cyclops releases its intended meal on the last scoop tick",()=>{
  let w=quiet(createBattle([at(1,"cyclops","red",398),at(2,"scout","blue",427)]));
  get(w,2).hp=10;w=advance(w,defs.cyclops.swallowTicks);assert.equal(get(w,1).windup.kind,"swallow");
  w.units.push(...createBattle([at(3,"kirin","blue",318)]).units);w=stepBattle(w);
  assert.equal(get(w,1).windup,undefined);assert.ok(get(w,1).stunnedUntil>w.tick);
  assert.equal(get(w,2).hp,10);assert.equal(get(w,2).swallowedTick,undefined);
});

test("a swallowed human disappears once, pays its original bounty once, and never rises from infection",()=>{
  const room=new Room();room.join();room.join();room.phase="running";
  room.world=quiet(createBattle([at(1,"cyclops","red",410),at(2,"warrior","blue",444),
    at(3,"drone","blue",412,193),at(4,"phoenix","blue",426,148),at(5,"archer","red",405,137)]));
  room.world.bases=["red","blue"].map(t=>makeBase("duel",t));
  for(const i of [2,3,4,5])get(room.world,i).hp=9;
  get(room.world,2).infection={team:"blue",until:300};
  for(let i=0;i<=defs.cyclops.swallowTicks;i++)room.advance();
  const swallowed=get(room.world,2);
  assert.equal(swallowed.hp,0);assert.equal(swallowed.swallowedTick,room.world.tick);
  assert.equal(swallowed.rising,undefined);assert.equal(get(room.world,1).lastSwallow.kind,"warrior");
  for(const i of [3,4,5])assert.equal(get(room.world,i).swallowedTick,undefined);
  assert.equal(room.gold.red,120+defs.warrior.bounty);
  room.advance();assert.equal(room.gold.red,126);
});

test("a bomb follows its marked ground point after the Bomber falls and damages the cluster exactly once",()=>{
  let world=quiet(createBattle([at(1,"bomber","red",260),at(2,"post","blue",395),at(3,"post","blue",427),
    at(4,"archer","blue",402,189),at(5,"archer","red",403,195)]));
  get(world,1).nextAttackTick=1;world=stepBattle(world);
  const bomb=world.arrows.find(a=>a.kind==="bomb");assert.ok(bomb);const land=bomb.landTick;
  get(world,1).hp=0;get(world,4).y=310;
  world=advance(world,land-world.tick-1);assert.equal(get(world,2).hp,37);
  world=stepBattle(world);assert.equal(world.effects[0].tick,land);assert.equal(world.arrows.length,0);
  for(const [id,hp] of [[2,24],[3,24],[4,20],[5,20]])assert.equal(get(world,id).hp,hp);
  assert.equal(get(advance(world,20),2).hp,24);
});

test("one bullet pierces two enemies in contact order, remembers a previous hit, and stops on a facing shield",()=>{
  for(const shield of [true,false]){
    let world=quiet(createBattle([at(1,"musketeer","red",250),at(2,"post","blue",350),
      at(3,shield?"shieldbearer":"post","blue",395),at(4,"post","blue",433),at(5,"post","red",330)]));
    get(world,1).nextAttackTick=1;world=stepBattle(world);
    assert.equal(world.arrows[0].kind,"bullet");assert.equal(get(world,2).hp,37);
    world=waitFor(world,w=>w.arrows.some(a=>a.piercedIds?.length===1));const saved=JSON.parse(JSON.stringify(world));
    world=advance(world,18);assert.equal(get(world,2).hp,26);
    assert.equal(get(world,3).hp,(shield?46:37)-(shield?2:6));assert.equal(get(world,4).hp,37);
    assert.deepEqual(advance(saved,18),world);
  }
  let world=quiet(createBattle([at(2,"shieldbearer","blue",354),at(3,"post","blue",390)]));
  world.arrows.push(shot("bullet","red",340,170,90,11));world=stepBattle(world);
  assert.equal(get(world,2).hp,43);assert.equal(get(world,3).hp,37);assert.equal(world.arrows.length,0);
});

test("a Frost Queen shard slows several enemies only on impact and movement returns to normal at expiry",()=>{
  let world=quiet(createBattle([at(1,"frostqueen","red",220),at(2,"lancer","blue",330),
    at(3,"warrior","blue",339,191),at(4,"warrior","blue",480),at(5,"post","red",320,207)]));
  get(world,1).nextAttackTick=1;world=stepBattle(world);
  assert.equal(world.arrows[0].kind,"ice");assert.equal(get(world,2).slowUntil,undefined);
  world=waitFor(world,w=>w.effects?.some(e=>e.kind==="frost"));
  const until=get(world,2).slowUntil;assert.equal(until,world.tick+defs.frostqueen.slowTicks);
  assert.equal(get(world,3).slowUntil,until);assert.equal(get(world,4).slowUntil,undefined);assert.equal(get(world,5).hp,37);
  const runner=get(world,2);
  world.units=[runner,...createBattle([at(9,"post","red",930,runner.y)]).units];get(world,9).nextAttackTick=10000;
  const x=runner.x;world=stepBattle(world);assert.ok(Math.abs(get(world,2).x-x-defs.lancer.speed*defs.frostqueen.speedFactor/60)<.0001);
  world=advance(world,until-world.tick-1);const last=get(world,2).x;world=stepBattle(world);
  assert.ok(Math.abs(get(world,2).x-last-defs.lancer.speed/60)<.0001);
});

test("poison ticks on its schedule, ignores machines, and a Medic's completed treatment clears it",()=>{
  let world=quiet(createBattle([at(1,"medic","blue",395),at(2,"warrior","blue",424),at(3,"post","blue",510)]));
  world.arrows.push(shot("venom","red",424,170,3,3),shot("venom","red",510,170,3,3));
  world=stepBattle(world);assert.equal(get(world,2).hp,27);assert.equal(get(world,3).poison,undefined);
  const unattended=JSON.parse(JSON.stringify(world));unattended.units=unattended.units.filter(u=>u.id!==1);
  assert.equal(get(advance(unattended,29),2).hp,27);
  const last=advance(unattended,90);assert.equal(get(last,2).hp,18);assert.equal(get(last,2).poison,undefined);
  world=waitFor(world,w=>!!get(w,1).lastHealTick);assert.equal(get(world,2).poison,undefined);assert.equal(get(world,2).hp,30);
});

test("Phoenix talons ignite the target; its egg does not spread fire, and friendly Rain extinguishes a burning ally",()=>{
  let world=quiet(createBattle([at(1,"phoenix","red",400),at(2,"warrior","blue",430),at(3,"scout","blue",435,198)]));
  get(world,1).nextAttackTick=1;world=stepBattle(world);const initial=get(world,2).hp;
  assert.equal(get(world,2).burn.team,"red");assert.equal(get(world,3).burn,undefined);
  world.arrows.push(shot("dart","blue",400,170,1,50));world=stepBattle(world);
  assert.ok(get(world,1).emberUntil);world=advance(world,23);assert.equal(get(world,2).hp,initial-2);
  assert.equal(get(world,3).burn,undefined);
  world.spells=[{kind:"rain",team:"blue",id:99,x:430,y:170,startTick:world.tick}];world=advance(world,12);
  assert.equal(get(world,2).burn,undefined);assert.equal(get(world,1).hp,0);
});

test("a bitten human rises with the original ID for the biter, pays once per life and restores from a saved tick",()=>{
  const room=new Room();room.join();room.join();room.phase="running";
  room.world=quiet(createBattle([at(1,"zombie","red",400),at(2,"musketeer","blue",426),at(3,"post","blue",570)]));
  room.world.bases=["red","blue"].map(t=>makeBase("duel",t));
  get(room.world,1).nextAttackTick=1;get(room.world,2).hp=5;room.advance();
  assert.equal(get(room.world,2).rising.team,"red");assert.equal(room.gold.red,120+defs.musketeer.bounty);
  const saved=JSON.parse(JSON.stringify(room.world));
  for(let i=0;i<defs.zombie.riseTicks;i++)room.advance();
  assert.deepEqual(advance(saved,defs.zombie.riseTicks),room.world);
  const raised=get(room.world,2);assert.deepEqual([raised.kind,raised.team,raised.hp],["zombie","red",25]);
  assert.equal(raised.killedBy,undefined);assert.equal(room.gold.red,128);
  room.world.arrows.push(shot("bullet","blue",raised.x,raised.y,0,40));room.advance();
  assert.equal(get(room.world,2).hp,0);assert.equal(room.gold.blue,125);
});

test("a pending resurrection keeps the playground awake; losing the biting army's base cancels it",()=>{
  const play=new Playground();
  play.place("red",{type:"place-zombies",positions:[{x:400,y:180}]});
  play.place("blue",{type:"place-warriors",positions:[{x:428,y:180}]});
  get(play.world,2).hp=1;play.advance();const promise=get(play.world,2).rising;
  get(play.world,1).hp=0;assert.equal(battleOutcome(play.world),null);
  for(let i=0;i<defs.zombie.riseTicks;i++)play.advance();
  assert.equal(get(play.world,2).raisedTick,promise.tick);assert.equal(get(play.world,2).team,"red");
  let world=quiet(createBattle([at(2,"archer","blue",410)]));
  world.bases=["red","blue"].map(t=>makeBase("duel",t));world.bases[0].hp=1;
  get(world,2).hp=0;get(world,2).rising={team:"red",tick:42};
  world.units.push(...createBattle([at(3,"warrior","blue",507)]).units);
  get(world,3).burn={team:"red",applied:0,until:72,next:24};get(world,3).infection={team:"red",until:155};
  world.arrows.push(shot("dart","blue",104,180,-1,5));world=stepBattle(world);
  assert.equal(get(world,2).rising,undefined);
  assert.equal(get(world,3).burn,undefined);assert.equal(get(world,3).infection,undefined);
});
