import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, stepBattle } from "../src/simulation.ts";
import { makeBase, TOWER } from "../src/battlefield.ts";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";
import { Playground } from "../src/playground.ts";
import { Room } from "../server/room.ts";

const at = (id, kind, team, x, y = 180) => ({id, kind, team, x, y});
const find = (world,id) => world.units.find(unit => unit.id === id);
function advance(world, ticks) { for (let i=0;i<ticks;i++) world=stepBattle(world); return world; }
function until(world, check, limit=400) {
  for(let i=0;i<limit && !check(world);i++) world=stepBattle(world);
  assert.ok(check(world),"event did not occur by tick "+world.tick);return world;
}
const shot = (team,x,y,vx,damage=8,kind) => ({team,x,y,vx,vy:0,damage,releasedTick:0,...(kind?{kind}:{})});
const cast = (world,kind,team,x,y,id=500) => {
  world.spells=[...(world.spells??[]),{id,kind,team,x,y,startTick:world.tick}];
  return world;
};
const quiet = world => { for(const u of world.units)u.nextAttackTick=100_000;return world; };

test("a tower sights only living hostile troops within 160, waits, and pays on bolt impact",()=>{
  const room=new Room();room.join();room.join();room.phase="running";
  room.world=quiet(createBattle([at(9,"post","blue",265),at(8,"shieldbearer","red",96)]));
  room.world.bases=["red","blue"].map(t=>makeBase("duel",t));
  for(let i=0;i<30;i++)room.advance();
  assert.equal(room.world.bases[0].targetId,null);assert.equal(room.world.arrows.length,0);
  const target=find(room.world,9);target.x=264;target.hp=6;
  room.advance();const locked=room.world.tick;
  assert.equal(room.world.bases[0].targetId,9);
  for(let i=0;i<TOWER.sightTicks-1;i++)room.advance();
  assert.equal(room.world.arrows.length,0);
  room.advance();assert.equal(room.world.bases[0].lastShotTick,locked+TOWER.sightTicks);
  assert.equal(find(room.world,9).hp,6);assert.equal(room.world.arrows[0].kind,"bolt");
  while(find(room.world,9).hp>0 && room.world.tick<110)room.advance();
  assert.equal(find(room.world,9).killedBy,"red");
  assert.equal(room.gold.red,120+4*Math.floor(room.world.tick/60)+defs.post.bounty);
  room.advance();assert.equal(room.world.bases[0].targetId,null);
});

test("tower locks break by ID, restart on leaving range, and observe the reload interval",()=>{
  let w=quiet(createBattle([at(8,"post","blue",240,200),at(3,"post","blue",240,160)]));
  w.bases=[makeBase("duel","red")];w=advance(w,4);
  assert.equal(w.bases[0].targetId,3);
  find(w,3).x=400;w=stepBattle(w);
  assert.equal(w.bases[0].targetId,8);assert.equal(w.bases[0].acquiredTick,5);
  w=advance(w,18);assert.equal(w.bases[0].lastShotTick,23);
  w=advance(w,71);assert.equal(w.bases[0].lastShotTick,23);
  w=stepBattle(w);assert.equal(w.bases[0].lastShotTick,95);
  w.bases[0].hp=0;w=advance(w,90);assert.equal(w.bases[0].lastShotTick,95);
});

test("the Shieldbearer raises its shield before impact; frontal and rear shots resolve differently",()=>{
  for(const [kind,front,damage] of [[undefined,true,2],["bolt",true,2],[undefined,false,8],["bullet",true,2]]) {
    let w=quiet(createBattle([at(1,"shieldbearer","red",350),at(2,"post","blue",600)]));
    w.arrows.push(shot("blue",front?400:316,180,front?-5:5,8,kind));
    w=stepBattle(w);
    assert.equal(find(w,1).hp,defs.shieldbearer.maxHp);
    if(front) assert.equal(find(w,1).lastBraceTick,1);
    w=until(w,s=>find(s,1).hp<defs.shieldbearer.maxHp);
    assert.equal(find(w,1).hp,defs.shieldbearer.maxHp-damage);
    assert.equal(find(w,1).lastBlockTick!==undefined,damage===2);
    assert.equal(w.arrows.length,0);
  }
});

test("a lowered lance charges a Warrior; a head-on Shieldbearer checks the Lancer",()=>{
  for(const target of ["warrior","shieldbearer"]) {
    let w=createBattle([at(1,"lancer","red",260),at(2,target,"blue",510)]);
    find(w,2).nextAttackTick=10000;
    w=until(w,s=>find(s,1).lastChargeTick!==undefined);
    const braced=target==="shieldbearer";
    assert.equal(find(w,2).hp,defs[target].maxHp-(braced?7:16));
    assert.equal(!!find(w,1).stunnedUntil,braced);
    if(braced) assert.equal(find(w,2).lastBlockTick,w.tick);
  }
});

test("a Lancer doubles speed after 52 units, spends the charge on one thrust, and resumes from mid-sprint",()=>{
  const spec=defs.lancer;
  let world=createBattle([at(1,"lancer","red",240),at(2,"post","blue",650)]);
  find(world,2).nextAttackTick=10000;
  const step=spec.speed/60, warmup=Math.ceil(spec.runUp/step);
  world=advance(world,warmup-1);
  assert.ok(Math.abs(find(world,1).x-240-(warmup-1)*step)<1e-8);
  assert.equal(find(world,1).lastChargeReadyTick,undefined);
  assert.equal(find(world,1).trail,undefined);
  world=stepBattle(world);
  assert.equal(find(world,1).lastChargeReadyTick,warmup);
  const before=find(world,1).x;
  world=stepBattle(world);
  assert.ok(Math.abs(find(world,1).x-before-2*step)<1e-8);
  assert.ok(find(world,1).trail.length);
  const room=new Room(); room.world=world;
  const saved=Room.restore(JSON.parse(JSON.stringify(room.checkpoint(1)))).world;
  const hit=until(world,w=>find(w,1).lastChargeTick!==undefined);
  assert.equal(find(hit,2).hp,defs.post.maxHp-spec.damage-spec.bonus);
  assert.equal(find(hit,1).runUp,0);
  const nextJab=advance(hit,spec.cooldownTicks);
  assert.equal(find(nextJab,1).lastChargeTick,hit.tick);
  assert.equal(find(nextJab,2).hp,find(hit,2).hp-spec.damage);
  assert.deepEqual(advance(saved,nextJab.tick-saved.tick),nextJab);
});

test("a Lancer turning into a nearby enemy jabs at normal speed, and a Gust cannot supply the run-up",()=>{
  const spec=defs.lancer;
  const world=createBattle([at(1,"lancer","red",260),at(2,"post","blue",710)]);
  const ready=until(world,w=>find(w,1).runUp>=spec.runUp);
  const x=find(ready,1).x;
  ready.units.push(...createBattle([at(3,"post","blue",x-46)]).units);
  const turned=stepBattle(ready);
  assert.ok(Math.abs(find(turned,1).x-x+spec.speed/60)<1e-8);
  assert.equal(find(turned,3).hp,defs.post.maxHp-spec.damage);
  assert.equal(find(turned,1).lastChargeTick,undefined);
  assert.equal(find(turned,1).runUp,0);

  const alone=createBattle([at(1,"lancer","red",300)]);
  find(alone,1).runUp=spec.runUp-1;
  alone.spells=[{id:5,kind:"gust",team:"blue",x:280,y:180,startTick:-7}];
  const blown=find(stepBattle(alone),1);
  assert.ok(blown.x>320);
  assert.equal(blown.runUp,0);
  assert.equal(blown.lastChargeReadyTick,undefined);
});

test("a Medic wraps a wounded person, never a machine; a hit on the final wrap tick interrupts it",()=>{
  let w=quiet(createBattle([at(1,"medic","red",380),at(2,"warrior","red",405),at(3,"drone","red",370,192)]));
  find(w,2).hp=18;find(w,3).hp=8;
  w=advance(w,24);
  assert.equal(find(w,1).targetId,2);assert.equal(find(w,2).hp,18);
  const held=structuredClone(w);
  const done=stepBattle(w);assert.equal(find(done,2).hp,26);assert.equal(find(done,1).lastHealTick,25);assert.equal(find(done,3).hp,8);
  held.arrows.push(shot("blue",find(held,1).x,find(held,1).y,-5));
  const interrupted=stepBattle(held);
  assert.equal(find(interrupted,2).hp,18);assert.equal(find(interrupted,1).wrappingSince,undefined);
  assert.equal(find(interrupted,1).aidReadyTick,49);
});

test("a full roster and its battlefield effects resume identically from a wire snapshot",()=>{
  const kinds=Object.keys(defs).filter(kind=>defs[kind].command);
  const squads=["red","blue"].flatMap((team,side)=>kinds.map((kind,i)=>at(side*100+i+1,kind,team,
    (side?625:335)+(i%4)*17,85+Math.floor(i/4)*48)));
  let w=createBattle(squads);w.bases=["red","blue"].map(team=>makeBase("duel",team));
  w=advance(w,100);cast(w,"rain","red",395,160);cast(w,"meteor","blue",390,180,501);
  w=advance(w,16);
  const restored=advance(JSON.parse(JSON.stringify(w)),280);
  const original=advance(w,280);
  assert.deepEqual(restored,original);
  assert.ok(original.units.length>squads.length);
  assert.equal(new Set(original.units.map(u=>u.id)).size,original.units.length);
  for(const u of original.units) {
    const r=defs[u.kind].radius;
    assert.ok(u.x>=r && u.x<=960-r && u.y>=r && u.y<=360-r);
    assert.ok(Number.isFinite(u.hp) && u.hp>=0 && u.hp<=defs[u.hex?.kind ?? u.kind].maxHp);
  }
});

test("the Mouse Workshop produces exactly three unique children and Undo removes its brood",()=>{
  const play=new Playground();
  play.place("blue",{type:"place-watchposts",positions:[{x:920,y:180}]});
  play.place("red",{type:"place-workshops",positions:[{x:65,y:180}]});
  for(let i=0;i<370;i++)play.advance();
  assert.equal(find(play.world,2).builtCount,3);
  const brood=play.world.units.filter(u=>u.makerId===2);
  assert.equal(brood.length,3);assert.equal(new Set(brood.map(u=>u.id)).size,3);
  assert.ok(brood.every(u=>u.kind==="mouse" && u.team==="red"));
  play.undo();assert.deepEqual(play.world.units.map(u=>u.id),[1]);
});

test("an Engineer builds a single Watchpost and repairs its damaged mechanism",()=>{
  let w=quiet(createBattle([at(1,"engineer","red",350),at(2,"post","blue",480)]));
  w=until(w,s=>!!s.units.find(u=>u.makerId===1));
  const post=w.units.find(u=>u.makerId===1);
  assert.equal(post.kind,"post");post.hp=21;
  w=until(w,s=>find(s,1).lastHealTick!==undefined);
  assert.equal(find(w,post.id).hp,29);assert.equal(find(w,1).targetId,post.id);
  assert.equal(w.units.filter(u=>u.makerId===1).length,1);
});

test("a metal target carries the Kirin's next spark across a gap that an organic target cannot bridge",()=>{
  for(const first of ["mouse","warrior"]){
    let w=createBattle([at(1,"kirin","red",220),at(2,first,"blue",309),at(3,"medic","blue",402),at(4,"archer","blue",430)]);
    w=stepBattle(w);
    assert.equal(find(w,1).arc.path.length,first==="mouse"?4:2);
    assert.equal(find(w,3).hp,defs.medic.maxHp-(first==="mouse"?7:0));
    assert.equal(find(w,4).hp,defs.archer.maxHp-(first==="mouse"?5:0));
  }
});

test("the Drone's three darts keep their first firing line after its target moves",()=>{
  let w=createBattle([at(1,"drone","red",220),at(2,"post","blue",330)]);
  w=stepBattle(w);const first=w.arrows.find(a=>a.team==="red");
  find(w,2).y+=90;w=advance(w,14);
  const darts=w.arrows.filter(a=>a.team==="red");
  assert.deepEqual(darts.map(a=>a.releasedTick).sort((a,b)=>a-b),[1,8,15]);
  assert.ok(darts.every(a=>a.vx===first.vx && a.vy===first.vy));
});

function ember(){
  let w=createBattle([at(1,"phoenix","red",400)]);w.units[0].hp=5;w.arrows.push(shot("blue",400,180,-5));
  return stepBattle(w);
}
test("a Phoenix ember hatches once, a friendly Gust fans it early, and enemy rain douses it",()=>{
  let w=ember();assert.equal(w.units[0].hp,1);assert.equal(w.units[0].killedBy,undefined);
  const hatches=advance(structuredClone(w),90);assert.equal(hatches.units[0].hp,Math.ceil(defs.phoenix.maxHp/2));
  assert.equal(hatches.units[0].emberUntil,undefined);
  hatches.arrows.push(shot("blue",400,180,-5,30));assert.equal(stepBattle(hatches).units[0].hp,0);
  const early=advance(cast(structuredClone(w),"gust","red",400,180),8);assert.equal(early.units[0].hp,Math.ceil(defs.phoenix.maxHp/2));
  assert.equal(early.units[0].lastHatchTick,9);
  w.bases=[makeBase("duel","red"),makeBase("duel","blue")];
  const out=advance(cast(w,"rain","blue",400,180),12);assert.equal(out.units[0].hp,0);assert.equal(out.units[0].killedBy,"blue");
});

test("Gust deflects hostile shafts, leaves heavy bombs airborne, pushes troops and leaves buildings rooted",()=>{
  let w=quiet(createBattle([at(1,"warrior","blue",430),at(2,"post","blue",430,213)]));
  w=cast(w,"gust","red",400,180);w=advance(w,7);
  w.arrows.push(shot("blue",360,175,5),{...shot("blue",360,174,3,8,"bomb"),landTick:30});
  w=stepBattle(w);assert.ok(find(w,1).x>455);assert.deepEqual([find(w,2).x,find(w,2).y],[430,213]);
  assert.deepEqual(w.arrows.map(a=>a.kind),["bomb"]);
});
test("rain pulses three times and a marked Meteor hits only the enemies still inside on the impact tick",()=>{
  let w=quiet(createBattle([at(1,"warrior","red",400),at(2,"post","blue",430),at(3,"archer","blue",446,187)]));
  find(w,1).hp=8;
  cast(w,"rain","red",400,180);w.spells.push({id:501,team:"red",kind:"meteor",x:434,y:180,startTick:0});
  w=advance(w,11);assert.equal(find(w,1).hp,8);w=stepBattle(w);assert.equal(find(w,1).hp,13);
  w=advance(w,35);find(w,3).x=600;assert.equal(find(w,2).hp,defs.post.maxHp);
  w=stepBattle(w);assert.equal(find(w,2).hp,defs.post.maxHp-17);assert.equal(find(w,3).hp,defs.archer.maxHp);assert.equal(find(w,1).hp,18);
  w=advance(w,36);assert.equal(find(w,1).hp,23);
});

test("live spells target opposing territory; a retried cast retains its ID and incurs exactly one charge",()=>{
  const room=new Room();const red=room.join();room.join();
  const order={type:"cast-meteor",positions:[{x:850,y:180}]};
  assert.match(room.place("red",1,1,order),/unlock/);room.phase="running";
  assert.match(room.place("red",1,1,{...order,positions:[{x:970,y:180}]}),/inside/);
  assert.match(room.place("red",1,1,{...order,positions:[...order.positions,...order.positions]}),/one spot/);
  const bought=room.place("red",1,1,order);assert.equal(room.gold.red,100);assert.equal(bought.ack.spellId,room.world.spells[0].id);
  room.disconnect("red");room.advance();room.join(red.resumeToken);
  assert.deepEqual(room.place("red",1,1,order),{ack:bought.ack,fresh:false});
  assert.equal(room.gold.red,100);assert.equal(room.world.spells.length,1);
  for(let i=0;i<47;i++)room.advance();assert.equal(room.world.bases[1].hp,154);
  assert.match(room.place("red",1,1,{type:"cast-gust",positions:order.positions}),/different stroke/);
});
