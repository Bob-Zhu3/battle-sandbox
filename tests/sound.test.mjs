import assert from "node:assert/strict";
import test from "node:test";
import { createBattle, stepBattle } from "../src/simulation.ts";
import { Playground } from "../src/playground.ts";
import { battleCues, createCueMixer, pausedPlacementCues, matchCues } from "../src/sound-events.ts";
import { SPELLS } from "../src/spells.ts";
import { RECRUIT_KINDS, UNIT_DEFINITIONS } from "../src/units.ts";
import { soundFor } from "../src/audio/sound-design.ts";
import { fieldTakes } from "../src/audio/field-takes.ts";

test("room signals follow confirmed transitions and joining a finished round stays quiet",()=>{
  const lobby={round:1,phase:"deploy",world:createBattle([]),seats:{red:{ready:false}}};
  const ready={...lobby,seats:{red:{ready:true}}}, three={...ready,phase:"countdown",countdown:3};
  const two={...three,countdown:2}, live={...two,phase:"running"}, end={...live,phase:"finished",outcome:"red"};
  assert.equal(matchCues(lobby,ready,"red")[0].kind,"ready");
  assert.deepEqual([matchCues(ready,three,"red")[0].level,matchCues(three,two,"red")[0].level],[1,2]);
  assert.deepEqual(matchCues(two,two,"red"),[]);
  assert.equal(matchCues(two,live,"red")[0].kind,"march");
  assert.equal(matchCues(live,end,"red")[0].kind,"victory");
  assert.equal(matchCues(live,end,"blue")[0].kind,"defeat");
  assert.equal(matchCues(live,{...end,outcome:"draw"},"blue")[0].kind,"stalemate");
  assert.deepEqual(matchCues(undefined,end,"red"),[]);
  assert.deepEqual(matchCues(end,end,"red"),[]);
});

test("all 44 troops and buildings use the same brush tap while running or paused",()=>{
  for(const card of RECRUIT_KINDS){
    const game=new Playground(),before=game.world;
    game.place("blue",{type:UNIT_DEFINITIONS[card].command,positions:[{x:300,y:170}]});
    const cues=battleCues(before,game.world);
    assert.equal(cues.length,1,card);
    assert.equal(cues[0].kind,"place"); assert.equal(cues[0].unit,undefined);
    assert.equal(soundFor(cues[0]),undefined,"the placement tap is independent of the recording download");
    assert.deepEqual(pausedPlacementCues(before,game.world),cues);
    assert.deepEqual(pausedPlacementCues(game.world,game.world),[]);
  }
});

test("each spell has a short recorded preparation, separate from its battlefield sound",()=>{
  const preparations=new Set();
  for(const spell of Object.keys(SPELLS)){
    const game=new Playground(),before=game.world;
    game.cast("red",spell,510,170,{x:330,y:170});
    const [cue,...rest]=pausedPlacementCues(before,game.world);
    assert.deepEqual(rest,[]);assert.equal(cue.spell,spell);
    const [layer]=soundFor(cue);
    const [,length]=fieldTakes[layer.take];
    assert.ok(Math.min(layer.limit??Infinity,length/1000)/layer.speed<.23,spell);
    preparations.add(layer.take);
  }
  assert.equal(preparations.size,Object.keys(SPELLS).length);
});

test("simultaneous placements of different classes coalesce at the center of the stroke",()=>{
  const game=new Playground(),before=game.world;
  game.place("red",{type:"place-warriors",positions:[{x:210,y:160},{x:258,y:160}]});
  game.place("red",{type:UNIT_DEFINITIONS.monk.command,positions:[{x:580,y:160}]});
  const cues=battleCues(before,game.world);
  assert.equal(cues.length,1); assert.equal(cues[0].kind,"place"); assert.equal(cues[0].x,(210+258+580)/3);
  const mix=createCueMixer();
  assert.deepEqual(mix(cues,1),cues);assert.deepEqual(mix(cues,1.03),[]);
  assert.deepEqual(mix(cues,1.12),cues);
  assert.deepEqual(battleCues(undefined,game.world),[]);
});

test("a bandage finishes on healing and stays silent when the wrapping is interrupted",()=>{
  let world=createBattle([{id:1,team:"red",kind:"medic",x:380,y:180},{id:2,team:"red",kind:"warrior",x:405,y:180}]);
  world.units[1].hp=18;
  for(let i=0;i<24;i++){
    const next=stepBattle(world); assert.ok(!battleCues(world,next).some(c=>c.kind==="bandage")); world=next;
  }
  const finished=stepBattle(world);
  assert.ok(finished.units[1].hp>world.units[1].hp);
  assert.equal(battleCues(world,finished).filter(c=>c.kind==="bandage").length,1);
  const interrupted=structuredClone(world);
  interrupted.arrows.push({team:"blue",x:world.units[0].x,y:world.units[0].y,vx:-5,vy:0,damage:8,releasedTick:0});
  assert.ok(!battleCues(interrupted,stepBattle(interrupted)).some(c=>c.kind==="bandage"));
});

test("each actual punch gets its own contact in the Monk's four-hit flurry",()=>{
  let world=createBattle([{id:1,kind:"monk",team:"red",x:400,y:170},{id:2,kind:"post",team:"blue",x:430,y:170}]);
  world.units[1].nextAttackTick=1000;
  const beats=[];
  for(let i=0;i<30;i++){
    const next=stepBattle(world);
    for(const cue of battleCues(world,next))if(cue.kind==="punch")beats.push([next.tick,soundFor(cue)[0].take]);
    world=next;
  }
  assert.deepEqual(beats,[[1,"knuckles"],[9,"palm"],[17,"bodyHit"],[25,"shoulder"]]);
});

test("the field and room hear the Miner emerge and all three Drone releases even at point blank range",()=>{
  const game=new Playground();
  game.place("blue",{type:UNIT_DEFINITIONS.miner.command,positions:[{x:563,y:120}]});
  const emerge=game.world.units[0].tunnel.end, frames=[game.world];
  for(let i=0;i<emerge+5;i++){game.advance();frames.push(game.world);}
  const drone=[createBattle([{id:1,kind:"drone",team:"red",x:220,y:170},{id:2,kind:"post",team:"blue",x:235,y:170}])];
  for(let i=0;i<18;i++)drone.push(stepBattle(drone.at(-1)));
  function hear(sequence,stride,kind){
    const times=[];
    for(let i=stride;i<sequence.length;i+=stride)
      if(battleCues(sequence[i-stride],sequence[i]).some(c=>c.kind===kind))times.push(i);
    return times;
  }
  for(const stride of [1,3]){
    assert.deepEqual(hear(frames,stride,"breakSoil"),[Math.ceil(emerge/stride)*stride]);
    assert.deepEqual(hear(drone,stride,"droneBolt"),[1,8,15].map(t=>Math.ceil(t/stride)*stride));
  }
});

test("a Kirin's discharge follows the enemies it actually chained through",()=>{
  const world=createBattle([{id:1,kind:"kirin",team:"red",x:200,y:170},
    ...[275,321,368].map((x,i)=>({id:2+i,kind:"warrior",team:"blue",x,y:170}))]);
  const next=stepBattle(world);
  assert.deepEqual(battleCues(world,next).find(c=>c.kind==="thunder").chain,[275,321,368]);
  assert.ok(!battleCues(next,stepBattle(next)).some(c=>c.kind==="thunder"));
});

test("a bowstring sounds at release and a stationary target sounds once on impact", () => {
  let world = createBattle([{id:1, team:"red", kind:"archer", x:240, y:150}, {id:2, team:"blue", kind:"archer", x:340, y:150}]);
  world.units[1].nextAttackTick = 1000;
  const cues = [];
  for (let tick=1; tick<=49; tick++) {
    const after = stepBattle(world);
    for (const cue of battleCues(world,after)) cues.push([tick,cue.kind]);
    world = after;
  }
  assert.deepEqual(cues,[[1,"bow"],[19,"hit"],[31,"bowDraw"],[49,"bow"]]);
});

test("a Meteor whooshes once at purchase and lands on its damage tick in both snapshot cadences", () => {
  const game = new Playground(), start = game.world;
  game.cast("red","meteor",470,220);
  const launch = game.world;
  assert.deepEqual(battleCues(start,launch).map(c=>c.kind),["fall"]);
  assert.deepEqual(battleCues(launch,{...launch}),[]);
  const frames = [launch];
  for (let i=1; i<=SPELLS.meteor.duration; i++) { game.advance(); frames.push(game.world); }
  for (const stride of [1,3]) {
    const observed=[];
    for (let i=stride; i<frames.length; i+=stride) {
      for (const cue of battleCues(frames[i-stride],frames[i])) observed.push([i,cue.kind]);
    }
    assert.deepEqual(observed,[[SPELLS.meteor.delay,"impact"]]);
  }
  assert.deepEqual(battleCues(undefined,frames[50]),[]);
  assert.deepEqual(battleCues(frames[12],frames[50]),[]);
  assert.deepEqual(battleCues(frames[50],start),[]);
  const cancelled = new Playground();
  cancelled.cast("red","meteor",350,220); cancelled.undo();
  assert.deepEqual(battleCues(launch,cancelled.world),[]);
});

test("a fan whistles only when it turns a shot and a Prism chimes only when it takes the lock", () => {
  let w=createBattle([{id:1,kind:"windmill",team:"red",x:400,y:220},{id:2,kind:"archer",team:"blue",x:486,y:220},
    {id:3,kind:"prism",team:"red",x:400,y:65},{id:4,kind:"belltower",team:"blue",x:505,y:65}]);
  const frames=[w];
  for(let i=0;i<42;i++){w=stepBattle(w);frames.push(w);}
  for(const stride of [1,3]){
    const heard=[];
    for(let i=stride;i<frames.length;i+=stride)
      for(const cue of battleCues(frames[i-stride],frames[i]))if(cue.kind==="fan" || cue.kind==="prism")heard.push(cue.kind);
    assert.deepEqual(heard.sort(),["fan","prism"]);
  }
  assert.deepEqual(battleCues(undefined,w),[]);
});

test("one stroke and simultaneous hits each make a single spatial cue", () => {
  const game = new Playground(), empty = game.world;
  const positions = Array.from({length:20},(_,i)=>({x:240+i*12,y:160}));
  game.place("red",{type:"place-warriors",positions});
  const cues = battleCues(empty,game.world);
  assert.equal(cues.length,1); assert.equal(cues[0].kind,"place"); assert.equal(cues[0].x,354);
  assert.deepEqual(battleCues(game.world,{...game.world}),[]);
  const after = {...game.world,tick:1,units:game.world.units.map(u=>({...u,hp:u.hp-10,lastHitTick:1}))};
  assert.deepEqual(battleCues(game.world,after).map(c=>c.kind),["hit"]);
});

test("the Clown's bottle shatters on the ground, even after the thrower dies and a Gust clears the gas", () => {
  let world=createBattle([{id:1,team:"red",kind:"clown",x:302,y:180},{id:2,team:"blue",kind:"post",x:390,y:180}]);
  world.units[1].nextAttackTick=1000;
  const frames=[world];
  world=stepBattle(world);frames.push(world);
  assert.deepEqual(battleCues(frames[0],world).map(c=>c.kind),["toss"]);
  const landing=world.arrows[0].landTick;
  world.units[0].hp=0;
  world.spells=[{id:11,kind:"gust",team:"blue",x:390,y:180,startTick:landing+1-SPELLS.gust.delay}];
  while(world.tick<landing+15){world=stepBattle(world);frames.push(world);}
  assert.ok(frames[landing].effects.some(e=>e.kind==="miasma"));
  assert.ok(!frames[landing+1].effects.some(e=>e.kind==="miasma"));
  assert.ok(Math.abs(frames[landing].effects.find(e=>e.kind==="glass").x-390)<1e-8);
  for(const stride of [1,3]){
    const sounds=[];
    for(let i=stride;i<frames.length;i+=stride)
      for(const c of battleCues(frames[i-stride],frames[i]))if(c.kind==="glass")sounds.push([i,Math.round(c.x)]);
    assert.deepEqual(sounds,[[Math.ceil(landing/stride)*stride,390]]);
  }
  assert.deepEqual(battleCues(undefined,frames[landing+3]),[]);
});

test("voices follow the Lancer's running start and the Kirin's discharge", () => {
  let world=createBattle([{id:1,team:"red",kind:"lancer",x:270,y:180},{id:2,team:"blue",kind:"belltower",x:610,y:180}]);
  const charges=[];
  for(let t=1;t<=65;t++){
    const next=stepBattle(world);
    if(battleCues(world,next).some(c=>c.kind==="charge"))charges.push(t);
    world=next;
  }
  assert.deepEqual(charges,[world.units[0].lastChargeReadyTick]);
  assert.ok(charges[0]>1 && world.units[0].lastAttackTick===null);
  world=createBattle([{id:1,team:"red",kind:"kirin",x:380,y:180},{id:2,team:"blue",kind:"warrior",x:466,y:180}]);
  const strike=stepBattle(world);
  assert.deepEqual(new Set(battleCues(world,strike).map(c=>c.kind)),new Set(["kirinCall","thunder","hit"]));
  assert.deepEqual(battleCues(strike,stepBattle(strike)),[]);
});

test("wood, machinery and living voices have separate impact sounds, and a crowd leaves room for the glass tail", () => {
  const kinds=["warrior","post","drone","kirin","phoenix","pig"];
  const before=createBattle(kinds.map((kind,id)=>({id:id+1,kind,team:"red",x:210+id*55,y:180})));
  const after={...before,tick:1,units:before.units.map(u=>({...u,hp:u.hp-2,lastHitTick:1}))};
  assert.deepEqual(new Set(battleCues(before,after).map(c=>c.kind)),new Set(["hit","wood","metal","beastHurt","birdHurt","squeal"]));
  const mixer=createCueMixer(), together=["glass","howl","bow","hit"].map((kind,i)=>({kind,seed:i,x:500}));
  assert.deepEqual(mixer(together,1),together);
  assert.deepEqual(mixer(together,1.03),[]);
  assert.deepEqual(mixer(together,2),together);
});

test("a human keeps the same performer's voice when struck again", () => {
  const start=createBattle([{id:1,kind:"archer",team:"red",x:310,y:180}]), choices=[];
  for(const tick of [1,30,60,91]){
    const prior={...start,tick:tick-1};
    const after={...start,tick,units:[{...start.units[0],hp:18,lastHitTick:tick}]};
    const [cue]=battleCues(prior,after);
    assert.equal(cue.kind,"hit");choices.push(cue.seed%4);
  }
  assert.equal(new Set(choices.map(t=>t%2)).size,1);
  assert.equal(new Set(choices).size,2);
});

test("a Wormhole opens on placement and only sounds again when a living passenger crosses it", () => {
  for (const survives of [true,false]) {
    const game = new Playground();
    game.place("blue",{type:"place-watchposts",positions:[{x:160,y:180}]});
    if (!survives) game.world.units[0].hp=0;
    const before = game.world;
    game.cast("red","wormhole",780,180,{x:160,y:180});
    const frames = [game.world];
    assert.deepEqual(battleCues(before,frames[0]).map(c=>c.kind),["portalOpen"]);
    for (let t=1; t<=6; t++) { game.advance(); frames.push(game.world); }
    for (const stride of [1,3]) {
      const heard = [];
      for (let i=stride; i<frames.length; i+=stride) {
        for (const cue of battleCues(frames[i-stride],frames[i])) {
          if (cue.kind==="portalOpen" || cue.kind==="wormhole") heard.push([i,cue.kind,cue.x]);
        }
      }
      assert.deepEqual(heard,survives ? [[stride,"wormhole",780]] : []);
    }
    assert.deepEqual(battleCues(undefined,frames.at(-1)),[]);
  }
});
