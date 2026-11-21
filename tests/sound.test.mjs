import assert from "node:assert/strict";
import test from "node:test";
import { createBattle, stepBattle } from "../src/simulation.ts";
import { Playground } from "../src/playground.ts";
import { battleCues } from "../src/sound-events.ts";
import { SPELLS } from "../src/spells.ts";

test("a bowstring sounds at release and a stationary target sounds once on impact", () => {
  let world = createBattle([{id:1, team:"red", kind:"archer", x:240, y:150}, {id:2, team:"blue", kind:"archer", x:340, y:150}]);
  world.units[1].nextAttackTick = 1000;
  const cues = [];
  for (let tick=1; tick<=48; tick++) {
    const after = stepBattle(world);
    for (const cue of battleCues(world,after)) cues.push([tick,cue.kind]);
    world = after;
  }
  assert.deepEqual(cues,[[1,"bow"],[19,"hit"]]);
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
