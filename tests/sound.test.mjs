import assert from "node:assert/strict";
import test from "node:test";
import { createBattle, stepBattle } from "../src/simulation.ts";
import { Playground } from "../src/playground.ts";
import { battleCues, createCueMixer } from "../src/sound-events.ts";
import { SPELLS } from "../src/spells.ts";

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
  assert.deepEqual(new Set(battleCues(world,strike).map(c=>c.kind)),new Set(["howl","thunder","hit"]));
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
