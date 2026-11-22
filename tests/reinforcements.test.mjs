import test from "node:test";
import assert from "node:assert/strict";
import { Room } from "../server/room.ts";
import { createBattle, stepBattle } from "../src/simulation.ts";
import { makeBase } from "../src/battlefield.ts";
import { arrowPose } from "../src/arrows.ts";
import { airborne, footprint, UNIT_DEFINITIONS as defs } from "../src/units.ts";
import { makeFieldSpell, SPELLS } from "../src/spells.ts";
import { bountyFor } from "../src/transformations.ts";
import { reinforcements, windmillField } from "../src/deployment.ts";

const newcomers=["wrestler","liondancers","rhinorider","trojanhorse","windmill","harpoon","prism","snowman",
  "hydra","medusa","vampire","sandworm","slime","horseman","werewolf","cerberus","kraken","firedragon","irongolem"];
const at=(id,kind,team,x,y=180)=>({id,kind,team,x,y});
const unit=(w,id)=>w.units.find(u=>u.id===id);
const json=w=>JSON.parse(JSON.stringify(w));
function step(w,n=1) { for(let i=0;i<n;i++) w=stepBattle(w); return w; }
function fight(kind,opponents,extra=[]) {
  const w=createBattle([at(1,kind,"red",400),...opponents,...extra]);
  for(const u of w.units) if(u.team!=="red") {u.nextAttackTick=9999;u.rootedUntil=9999;}
  return w;
}
const warrior=(id,x,y)=>at(id,"warrior","blue",x,y);
const spell=(w,kind,team,x,y=180)=>makeFieldSpell(100,kind,team,x,y,w.tick+1-SPELLS[kind].delay,w.units);

test("the playable opening shows the first hook grounding the Dragon and the horse and wolf meeting",()=>{
  let w=createBattle(reinforcements.map(([team,kind,x,y],i)=>at(i+1,kind,team,x,y)));
  const troop=kind=>w.units.find(u=>u.kind===kind);
  w=step(w);assert.equal(troop("harpoon").targetId,troop("firedragon").id);
  let grounded=false;
  for(let i=0;i<75;i++){w=step(w);if(troop("firedragon").groundedUntil>w.tick)grounded=true;}
  assert.equal(grounded,true);assert.ok(troop("trojanhorse").openedTick>0);assert.ok(troop("werewolf").wolfUntil>w.tick);
});

test("all nineteen recruits independently damage an ordinary Warrior",()=>{
  for(const kind of newcomers) {
    let w=fight(kind,[warrior(2,448)]);
    for(let t=0;t<180 && unit(w,2).lastHitTick===null;t++) w=step(w);
    assert.ok(unit(w,2).hp<defs.warrior.maxHp,defs[kind].name);
  }
});

test("Wrestler throws by weight, the rear Lion Dancer kicks, and stun stops a ready Rhino",()=>{
  let w=step(fight("wrestler",[warrior(2,433)]),9);
  assert.ok(unit(w,2).x<unit(w,1).x);
  w=step(fight("wrestler",[at(2,"irongolem","blue",435)]));
  assert.ok(unit(w,1).knockback.x<0);assert.equal(unit(w,2).knockback,undefined);
  w=step(fight("liondancers",[warrior(2,433),warrior(3,365)]));
  assert.equal(unit(w,1).lastKickTick,1);
  assert.equal(unit(w,2).hp,defs.warrior.maxHp-defs.liondancers.damage);
  assert.equal(unit(w,3).hp,defs.warrior.maxHp-defs.liondancers.kickDamage);
  let run=fight("rhinorider",[warrior(2,535)]);
  while(!unit(run,1).lastChargeReadyTick && run.tick<80) run=step(run);
  assert.ok(unit(run,1).runUp>=defs.rhinorider.runUp);
  assert.ok(unit(step(json(run),27),1).lastChargeTick);
  run.spells=[spell(run,"lightning","blue",unit(run,1).x)];run=step(run);
  assert.equal(unit(run,1).runUp,0);assert.equal(unit(run,1).lastChargeTick,undefined);
});

test("Trojan Horse unloads just once on contact or destruction and never after losing its base",()=>{
  for(const killed of [false,true]) {
    let w=fight("trojanhorse",[warrior(2,killed?580:442)]);
    if(killed) {unit(w,1).hp=1;w.spells=[spell(w,"lightning","blue",400)];}
    w=step(w);const kids=w.units.filter(u=>u.makerId===1);
    assert.equal(unit(w,1).openedTick,1);assert.equal(kids.length,2);
    assert.equal(new Set(kids.map(k=>k.id)).size,2);
    assert.ok(kids.every(k=>k.kind==="warrior" && k.team==="red" && k.id<-4));
    assert.equal(step(w,100).units.filter(u=>u.makerId===1).length,2);
  }
  let w=fight("trojanhorse",[warrior(2,470)]);const base=makeBase("duel","red");
  base.x=400;base.y=180;base.hp=1;w.bases=[base];w.spells=[spell(w,"lightning","blue",400)];
  w=step(w);assert.equal(w.units.length,2);assert.equal(unit(w,1).hp,0);
});

test("Windmill pushes continuously through its front cone, swivels and speeds up in a friendly Gust",()=>{
  const start=fight("windmill",[warrior(2,439),warrior(3,360),warrior(4,456,250),at(5,"post","blue",481,185)],
    [at(6,"archer","red",473,174)]);
  unit(start,6).nextAttackTick=9999;
  const w=step(start,9);
  assert.equal(unit(w,1).targetId,2);assert.ok(unit(w,2).x>441);
  for(const id of [2,5]) assert.equal(unit(w,id).hp,defs[unit(w,id).kind].maxHp-defs.windmill.damage);
  assert.equal(unit(w,5).x,481);
  for(const id of [3,4,6]) assert.equal(unit(w,id).lastHitTick,null);
  const boosted=json(start);boosted.spells=[spell(boosted,"gust","red",366)];
  const fast=step(boosted,9);
  assert.ok(unit(fast,1).millFastUntil>fast.tick);assert.ok(unit(fast,2).x>unit(w,2).x+1);
  unit(w,2).hp=0;
  const turned=step(w,9);assert.equal(unit(turned,1).targetId,3);assert.ok(unit(turned,3).x<359);
  assert.deepEqual(json(step(json(turned),27)),json(step(turned,27)));
});

test("a frontal stream turns an incoming arrow downwind, while the sides, rear and heavy shots get through",()=>{
  const shaft={x:536,y:180,vx:-145,vy:0,team:"blue",casterId:9,releasedTick:0,damage:8};
  const fire=(shot,troops=[],disabled=false)=>{
    const w=fight("windmill",[],troops);
    if(disabled) unit(w,1).stunnedUntil=15;
    w.arrows=[{...shaft,...shot}];
    return step(w);
  };
  const turned=fire({},[at(4,"warrior","red",437)]);
  assert.equal(unit(turned,1).lastBlockTick,1);assert.equal(turned.arrows.length,1);
  assert.equal(turned.arrows[0].vx,145);assert.equal(turned.arrows[0].x,400+defs.windmill.reach);
  assert.equal(turned.arrows[0].team,"blue");assert.equal(unit(turned,4).lastHitTick,null);
  const later=step(turned,2).arrows[0];
  assert.ok(later.x>turned.arrows[0].x);
  assert.equal(arrowPose(later,3,0).x,shaft.x);assert.equal(arrowPose(later,3,.1).vx,-145);
  assert.equal(arrowPose(later,3,.5).x,501);assert.equal(arrowPose(later,3,.5).vx,145);
  assert.equal(arrowPose(later,3,1.5).x,573.5);
  for(const w of [fire({x:335,vx:85}),fire({x:400,y:110,vx:0,vy:80}),fire({kind:"bullet"}),fire({},[],true)]) {
    assert.equal(unit(w,1).lastBlockTick,undefined);assert.equal(unit(w,1).lastHitTick,1);
  }
  const firstBody=fire({},[at(4,"warrior","red",521)]);
  assert.equal(unit(firstBody,4).lastHitTick,1);assert.equal(unit(firstBody,1).lastBlockTick,undefined);
  const friendly=fire({team:"red"});
  assert.equal(friendly.arrows[0].vx,shaft.vx);assert.equal(unit(friendly,1).lastBlockTick,undefined);
});

test("Prism opens with a primary lock and up to two side rays with stable ID ties",()=>{
  const foes=[warrior(9,455,164),warrior(4,455,196),warrior(3,477),warrior(8,320)];
  for(const order of [foes,[...foes].reverse()]) {
    const w=step(fight("prism",order));assert.equal(unit(w,1).targetId,4);
    assert.equal(unit(w,4).hp,defs.warrior.maxHp-defs.prism.damage);
    for(const id of [9,3])assert.equal(unit(w,id).hp,defs.warrior.maxHp-defs.prism.sideDamage);
    assert.equal(unit(w,8).hp,defs.warrior.maxHp);assert.deepEqual(unit(w,1).prismSides,[9,3]);
    assert.equal(unit(w,1).focusSince,1);assert.equal(w.effects,undefined);
  }
});

test("Prism holds its target between pulses, builds damage through five levels and resets after losing its lock",()=>{
  let w=fight("prism",[warrior(2,454),warrior(3,490,195),warrior(4,497,151)]);
  unit(w,2).hp=1000;
  const damages=[];
  for(let tick=1;tick<=166;tick++){
    const before=unit(w,2).hp;
    if(tick===60) unit(w,3).x=438;
    w=step(w);
    const tower=unit(w,1);assert.equal(tower.targetId,2);assert.equal(tower.focusSince,1);
    assert.equal(tower.prismSides?.length ?? 0,tick<73 ? 2 : tick<145 ? 1 : 0);
    if(tick%15===1) damages.push(before-unit(w,2).hp); else assert.equal(unit(w,2).hp,before);
  }
  assert.deepEqual(damages,[2,2,2,3,3,4,4,4,5,5,6,6]);
  assert.deepEqual(json(step(w,21)),json(step(json(w),21)));
  for(const reason of ["range","death","turned"]){
    const lost=json(w),old=unit(lost,2);
    if(reason==="range")old.x=700; else if(reason==="death")old.hp=0; else old.team="red";
    const fresh=step(lost);assert.equal(unit(fresh,1).targetId,3);assert.equal(unit(fresh,1).focusSince,167);
    assert.equal(unit(fresh,3).hp-unit(step(fresh,14),3).hp,2);
  }
  w.spells=[spell(w,"freeze","blue",400)];w=step(w);
  assert.equal(unit(w,1).focusSince,undefined);assert.equal(unit(w,1).targetId,null);assert.equal(unit(w,1).prismSides,undefined);
  w=step(w,unit(w,1).frozenUntil-w.tick);assert.equal(unit(w,1).focusSince,w.tick);
});

test("Harpoon travels before reeling in ground troops and flyers; Snowman slows on impact and repacks",()=>{
  for(const kind of ["warrior","firedragon"]) {
    let w=step(fight("harpoon",[at(2,kind,"blue",495)]));
    assert.equal(w.arrows[0].kind,"harpoon");assert.equal(unit(w,2).hp,defs[kind].maxHp);
    while(w.arrows.length && w.tick<50) w=step(w);
    assert.equal(unit(w,2).hp,defs[kind].maxHp-defs.harpoon.damage);assert.ok(unit(w,2).knockback.x<0);
    assert.equal(!!unit(w,2).groundedUntil,kind==="firedragon");assert.equal(airborne(unit(w,2)),false);
    if(kind==="firedragon") {unit(w,1).nextAttackTick=9999;w=step(w,defs.harpoon.groundTicks);assert.equal(airborne(unit(w,2)),true);}
    assert.ok(unit(step(w,8),2).x<495);
  }
  let w=step(fight("snowman",[warrior(2,490)]));
  assert.equal(w.arrows[0].kind,"snowball");assert.equal(unit(w,1).snowStock,2);assert.equal(unit(w,2).slowUntil,undefined);
  while(w.arrows.length && w.tick<33)w=step(w);
  assert.equal(unit(w,2).slowUntil,w.tick+defs.snowman.slowTicks);
  unit(w,1).nextAttackTick=9999;w=step(w,unit(w,1).repackAt-w.tick);assert.equal(unit(w,1).snowStock,3);
  unit(w,1).snowStock=0;w.spells=[spell(w,"freeze","red",400)];w=step(w);assert.equal(unit(w,1).snowStock,3);
});

test("Medusa damages both foes but only the one looking at her loses its charge and turns to stone",()=>{
  let w=fight("medusa",[at(2,"rhinorider","blue",465,176),warrior(3,472,198)]);
  w=step(w,defs.medusa.windup);assert.equal(unit(w,1).windup.kind,"gaze");
  unit(w,2).runUp=60;unit(w,2).aimX=-1;unit(w,3).aimX=1;unit(w,3).aimY=0;
  const snap=json(w);w=step(w);assert.deepEqual(json(w),json(step(snap)));
  assert.equal(unit(w,2).petrifiedUntil,w.tick+defs.medusa.stoneTicks);
  assert.equal(unit(w,2).runUp,0);assert.equal(unit(w,3).petrifiedUntil,undefined);
  assert.equal(unit(w,3).hp,defs.warrior.maxHp-defs.medusa.damage);
});

test("Dragon breath has an interruptible inhale, burns enemies in its cone and spares one to the side",()=>{
  let w=step(fight("firedragon",[warrior(2,472),warrior(3,480,197),warrior(4,410,265)]),defs.firedragon.windup);
  assert.equal(unit(w,2).lastHitTick,null);
  const canceled=json(w);canceled.spells=[spell(canceled,"lightning","blue",400)];
  const interrupted=step(canceled);assert.equal(unit(interrupted,1).windup,undefined);assert.equal(unit(interrupted,2).burn,undefined);
  w=step(w);assert.equal(w.effects.find(e=>e.kind==="breath").tick,w.tick);
  for(const id of [2,3])assert.ok(unit(w,id).burn);
  assert.equal(unit(w,4).hp,defs.warrior.maxHp);
  const before=unit(w,2).hp;assert.ok(unit(step(w,24),2).hp<before);
});

test("Sandworm dives out of reach, follows a curved ridge and erupts only at the ground it committed to",()=>{
  let w=step(fight("sandworm",[warrior(2,480),warrior(3,492,199)]));
  assert.equal(unit(w,1).windup.x,480);
  const stopped=json(w);stopped.spells=[spell(stopped,"lightning","blue",400)];
  assert.equal(unit(step(stopped,defs.sandworm.windup),1).tunnel,undefined);
  unit(w,2).x=580;
  w=step(w,defs.sandworm.windup-1);
  const original=json(w);
  w.arrows=[{x:390,y:180,vx:24,vy:0,team:"blue",damage:9,releasedTick:w.tick}];
  const packed=json(w),entry=step(w),path=unit(entry,1).tunnel;
  assert.deepEqual(json(w),packed);assert.ok(path.end>=entry.tick+defs.sandworm.minTunnelTicks);
  assert.equal(unit(entry,1).x,400);assert.equal(unit(entry,1).lastHitTick,null);assert.equal(entry.arrows.length,1);
  const midpoint=step(entry,Math.floor((path.end-path.start)/2));
  assert.ok(unit(midpoint,1).x>425 && unit(midpoint,1).x<455);assert.ok(Math.abs(unit(midpoint,1).y-180)>5);
  assert.equal(unit(midpoint,3).targetId,null);
  const saved=json(midpoint);
  const justBefore=step(midpoint,path.end-midpoint.tick-1);
  assert.equal(unit(justBefore,3).lastHitTick,null);
  w=step(justBefore);
  assert.equal(unit(w,1).emergedTick,path.end);assert.equal(unit(w,1).x,480);assert.equal(unit(w,1).tunnel,undefined);
  assert.equal(unit(w,1).walkDistance,0);assert.equal(unit(w,2).hp,defs.warrior.maxHp);
  assert.equal(unit(w,3).hp,defs.warrior.maxHp-defs.sandworm.damage);assert.ok(unit(w,3).knockback);
  assert.equal(w.effects.filter(e=>e.kind==="breach").length,1);
  assert.deepEqual(json(w),json(step(saved,path.end-midpoint.tick)));
  assert.equal(unit(step(w,10),3).hp,unit(w,3).hp);
  const faulted=json(midpoint);faulted.spells=[spell(faulted,"fault","blue",unit(midpoint,1).x,unit(midpoint,1).y)];
  const forced=step(faulted);assert.equal(unit(forced,1).emergedTick,forced.tick);assert.equal(unit(forced,1).tunnel,undefined);
  assert.equal(unit(forced,1).x,unit(midpoint,1).x);assert.equal(unit(forced,1).nextAttackTick,forced.tick+defs.sandworm.cooldownTicks);
  assert.ok(!forced.effects?.some(e=>e.kind==="breach"));
  // A stun landing on the last tick of the coil still catches the worm above ground.
  original.spells=[spell(original,"lightning","blue",400)];
  assert.equal(unit(step(original),1).windup,undefined);assert.equal(unit(step(original),1).tunnel,undefined);
});

test("nine body joints follow surface turns, fit corner spawns and recover old snapshots",()=>{
  for(const [x,y] of [[0,0],[960,0],[0,360],[960,360]]){
    const head=createBattle([at(1,"sandworm","red",x,y)]).units[0];
    assert.equal(head.wormBody.length,9);assert.ok(head.wormBody.every(p=>p.x>=5 && p.x<=955 && p.y>=5 && p.y<=355));
    assert.ok(Math.hypot(head.x-head.wormBody.at(-1).x,head.y-head.wormBody.at(-1).y)>55);
  }
  let w=fight("sandworm",[warrior(2,800)]);delete unit(w,1).wormBody;
  w=step(w,35);
  const before=json(w),body=unit(w,1).wormBody,oldHead=unit(w,1);
  assert.equal(body.length,9);assert.ok(Math.abs(oldHead.y-180)>1);
  unit(w,2).x=oldHead.x;unit(w,2).y=345;
  const turned=step(w,14),head=unit(turned,1);
  assert.ok(head.y-oldHead.y>12);
  assert.ok(Math.abs(head.wormBody.at(-1).y-body.at(-1).y)<4);
  assert.deepEqual(unit(w,1),unit(before,1));assert.notDeepEqual(head.wormBody,body);
  let prev=head;
  for(const joint of head.wormBody){assert.ok(Math.abs(Math.hypot(prev.x-joint.x,prev.y-joint.y)-9)<.15);prev=joint;}
});

test("the Windmill playground shows a turned arrow, two Sandworm dives and a fully focused Prism",()=>{
  let w=createBattle(windmillField.map(([team,kind,x,y],i)=>at(i+1,kind,team,x,y)));
  let arrowsTurned=0,breaches=0,fullFocus=false;
  for(let i=0;i<340;i++){
    w=step(w);
    if(unit(w,1).lastBlockTick===w.tick)arrowsTurned++;
    if(unit(w,4).emergedTick===w.tick)breaches++;
    if(w.tick-(unit(w,6).focusSince ?? Infinity)>=144 && unit(w,6).hp>0)fullFocus=true;
  }
  assert.ok(arrowsTurned>=1);assert.ok(breaches>=2);assert.ok(fullFocus);
});

test("Duel and FFA resume a live fan, a half-charged Prism and a tunneling Sandworm together",()=>{
  for(const mode of ["duel","ffa"]){
    const original=new Room(mode),joined=original.join();original.join();if(mode==="ffa")original.join();
    original.phase="running";
    original.world=createBattle(windmillField.map(([team,kind,x,y],i)=>at(i+1,kind,team,x,y)),0,
      (mode==="duel"?["red","blue"]:["red","blue","violet"]).map(t=>makeBase(mode,t)));
    while(!unit(original.world,4).tunnel && original.world.tick<200) original.advance();
    assert.ok(unit(original.world,4).tunnel);assert.ok(unit(original.world,6).focusSince);
    assert.ok(unit(original.world,1).lastBlockTick);
    original.disconnect("red");
    const rejoined=Room.restore(json(original.checkpoint(1)));
    assert.equal(rejoined.join(joined.resumeToken).team,"red");
    for(let i=0;i<120;i++){original.advance();rejoined.advance();}
    assert.deepEqual(json(rejoined.world),json(original.world));assert.deepEqual(rejoined.gold,original.gold);
  }
});

test("Hydra grows heads at wound thresholds, fire cauterizes the wound, and Cerberus can bite on three sides",()=>{
  for(const burning of [false,true]) {
    let w=fight("hydra",[warrior(2,436)]);
    unit(w,1).hp=Math.ceil(defs.hydra.maxHp*2/3)+1;
    if(burning)unit(w,1).burn={team:"blue",applied:0,next:24,until:72};
    unit(w,2).nextAttackTick=1;w=step(w);
    assert.equal(unit(w,1).heads,burning?1:3);assert.equal(unit(w,1).hydraWounds,1);
  }
  const w=step(fight("cerberus",[warrior(2,436),warrior(3,365),warrior(4,400,214)]));
  assert.ok([2,3,4].every(id=>unit(w,id).lastHitTick===1));
});

test("Vampire feeds on living foes, ordinary damage brings out the Werewolf, and Iron Golem carries a spare",()=>{
  for(const victim of ["warrior","post"]) {
    const w=fight("vampire",[at(2,victim,"blue",430)]);unit(w,1).hp=10;
    assert.equal(unit(step(w),1).hp,10+(victim==="warrior"?defs.vampire.drain:0));
  }
  let w=fight("werewolf",[warrior(2,431)]);unit(w,2).nextAttackTick=1;w=step(w);
  assert.equal(unit(w,1).wolfUntil,1+defs.werewolf.wolfTicks);
  unit(w,1).nextAttackTick=2;const hp=unit(w,2).hp;w=step(w);
  assert.equal(unit(w,2).hp,hp-defs.werewolf.clawDamage);assert.equal(unit(w,1).nextAttackTick,2+defs.werewolf.clawTicks);
  w=fight("irongolem",[warrior(2,435)]);const half=Math.floor(defs.irongolem.maxHp/2);unit(w,1).hp=half;
  w=step(w);assert.equal(unit(w,1).hp,half+defs.irongolem.repairHp);assert.equal(unit(w,1).spareUsed,true);
  unit(w,1).hp=half-2;w=step(w);assert.equal(unit(w,1).hp,half-2);
});

test("Slime halves share health at split, keep their IDs through a snapshot and reunite once",()=>{
  let w=fight("slime",[warrior(2,435)]);unit(w,2).nextAttackTick=1;w=step(w);
  const halves=w.units.filter(u=>u.kind==="slime");assert.equal(halves.length,2);
  assert.ok(halves.every(u=>u.smallSlime && footprint(u)===8));
  const total=defs.slime.maxHp-defs.warrior.damage;
  assert.equal(halves[0].hp+halves[1].hp,total);assert.equal(bountyFor(halves[1]),0);
  unit(w,2).nextAttackTick=9999;const saved=json(w);
  w=step(w,100);assert.deepEqual(json(w),json(step(saved,100)));
  assert.equal(unit(w,1).hp,total);assert.equal(unit(w,1).smallSlime,undefined);
  assert.equal(w.units.filter(u=>u.kind==="slime" && u.hp>0).length,1);
  unit(w,2).x=unit(w,1).x+18;unit(w,2).hp=40;unit(w,2).nextAttackTick=1;w=step(w);
  assert.equal(w.units.filter(u=>u.kind==="slime").length,2);
});

test("Kraken pulls one enemy to its beak or two together",()=>{
  let w=step(fight("kraken",[warrior(2,452)]));
  assert.ok(unit(w,2).knockback.x<0);
  w=step(fight("kraken",[warrior(2,447,157),warrior(3,447,203)]));
  assert.ok(unit(w,2).knockback.y>0 && unit(w,3).knockback.y<0);
});

test("Horseman retrieves a head at a tower and one blown behind enemy ranks",()=>{
  for(const victim of ["post","warrior"]) {
    let w=step(fight("horseman",[at(2,victim,"blue",507)]));
    assert.equal(w.arrows[0].kind,"head");
    while(unit(w,1).headLandedTick===undefined && w.tick<60)w=step(w);
    const rider=unit(w,1), spot={...rider.headSpot};
    assert.equal(rider.headLandedTick,w.tick);assert.equal(unit(w,2).lastHitTick,w.tick);
    if(victim==="warrior") {
      w.spells=[spell(w,"gust","blue",spot.x-2,spot.y)];w=step(w);
      assert.ok(unit(w,1).headSpot.x>spot.x+35);
    }
    unit(w,1).nextAttackTick=9999;w=step(w,180);
    assert.equal(unit(w,1).headSpot,undefined);assert.equal(unit(w,1).headUntil,undefined);
  }
});

test("Wormhole locks the nearest mobile ally by ID and jumps on its pulse without crossing an intervening shot",()=>{
  let w=createBattle([at(8,"warrior","red",200,150),at(4,"slime","red",200,210),at(7,"prism","red",548,230),warrior(3,765)]);
  for(const u of w.units){u.rootedUntil=1000;u.nextAttackTick=9999;}
  unit(w,4).hp=9;w.spells=[makeFieldSpell(90,"wormhole","red",550,180,0,w.units)];
  assert.equal(w.spells[0].portalUnitId,4);w=step(w,14);assert.equal(unit(w,4).x,200);
  w.arrows=[{team:"blue",x:390,y:195,vx:0,vy:1,damage:7,releasedTick:14}];
  const before=json(w),old=w;w=step(w);assert.deepEqual(before,json(old));
  assert.equal(unit(w,4).warpedTick,15);assert.equal(unit(w,4).x,550);
  assert.equal(unit(w,4).hp,9);assert.equal(w.arrows.length,1);assert.deepEqual(json(step(before)),json(w));
  const dead=json(before);unit(dead,4).hp=0;
  const fizzle=step(dead);assert.equal(fizzle.spells[0].portalUnitId,undefined);assert.equal(unit(fizzle,8).warpedTick,undefined);
});

test("Duel and FFA restore the same Wormhole passenger and purchase after reconnect",()=>{
  for(const mode of ["duel","ffa"]) {
    let room=new Room(mode);const joined=room.join();room.join();if(mode==="ffa")room.join();
    const sides=mode==="duel"?["red","blue"]:["red","blue","violet"];
    const home=makeBase(mode,"red");
    room.phase="running";room.world=createBattle([],0,sides.map(side=>makeBase(mode,side)));
    const cmd={type:"cast-wormhole",positions:[{x:715,y:105}]};
    assert.match(room.place("red",1,2,cmd),/mobile ally/);assert.equal(room.gold.red,120);
    const placed=room.place("red",1,1,{type:defs.rhinorider.command,positions:[home]});
    const passenger=placed.ack.unitIds[0],receipt=room.place("red",1,2,cmd),gold=120-defs.rhinorider.cost-SPELLS.wormhole.cost;
    assert.equal(room.world.spells[0].portalUnitId,passenger);assert.equal(room.gold.red,gold);
    for(let i=0;i<7;i++)room.advance();room.disconnect("red");room=Room.restore(json(room.checkpoint(2)));
    assert.equal(room.join(joined.resumeToken).team,"red");
    assert.deepEqual(room.place("red",1,2,cmd),{ack:receipt.ack,fresh:false});
    for(let i=0;i<8;i++)room.advance();
    assert.equal(room.world.spells.length,1);assert.equal(room.gold.red,gold);
    assert.equal(unit(room.world,passenger).warpedTick,15);assert.equal(unit(room.world,passenger).x,715);
  }
});
