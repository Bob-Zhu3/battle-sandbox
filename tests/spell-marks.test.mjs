import test from "node:test";
import assert from "node:assert/strict";
import { Room } from "../server/room.ts";
import { Playground } from "../src/playground.ts";
import { stepBattle } from "../src/simulation.ts";
import { MARK_TICKS, MAX_SPELL_MARKS, SPELLS } from "../src/spells.ts";

test("each spell leaves one mark after its final combat tick and cleans it up on an empty field",()=>{
  for (const [kind,rule] of Object.entries(SPELLS)) {
    const game=new Playground();
    const entrance=kind==="wormhole" ? {x:228,y:125} : undefined;
    game.cast("red",kind,540,183,entrance);
    for (let i=1;i<rule.duration;i++) game.advance();
    assert.equal(game.world.spells[0].kind,kind);
    assert.equal(game.world.marks,undefined);
    game.advance();
    assert.equal(game.world.spells,undefined);
    const marks=game.world.marks;
    assert.equal(marks.length,1);
    assert.deepEqual([marks[0].kind,marks[0].x,marks[0].y,marks[0].startTick],[kind,540,183,0]);
    if (entrance) assert.deepEqual(marks[0].entrance,entrance);
    game.paused=true;
    const paused=game.world;
    game.advance(); assert.equal(game.world,paused);
    game.paused=false;
    for (let i=1;i<MARK_TICKS[kind];i++) game.advance();
    assert.deepEqual(game.world.marks,marks);
    game.advance();
    assert.equal(game.world.marks,undefined);
    const empty=game.world;
    game.advance(); assert.equal(game.world,empty);
  }
});

test("lightning scars remember the struck positions through a server restart and cannot hit twice",()=>{
  const game=new Playground();
  game.place("blue",{type:"place-warriors",positions:[{x:201,y:140},{x:248,y:150},{x:230,y:181}]});
  game.cast("red","lightning",228,158);
  for (let i=0;i<SPELLS.lightning.delay;i++) game.advance();
  const strikes=game.world.spells[0].strikes;
  assert.equal(strikes.length,3);
  const health=game.world.units.map(u=>u.hp);
  for (let i=SPELLS.lightning.delay;i<SPELLS.lightning.duration;i++) game.advance();
  assert.deepEqual(game.world.marks[0].strikes,strikes);
  const room=new Room("ffa"); room.world=game.world;
  const restored=Room.restore(JSON.parse(JSON.stringify(room.checkpoint(9))));
  assert.deepEqual(restored.snapshot(10).world.marks,room.snapshot(10).world.marks);
  let copy=restored.world;
  for (let i=0;i<MARK_TICKS.lightning;i++) { copy=stepBattle(copy); game.advance(); }
  assert.deepEqual(copy.units.map(u=>u.hp),health);
  assert.deepEqual(game.world.units.map(u=>u.hp),health);
  assert.equal(copy.marks,undefined);
});

test("the floor has a bounded history and Undo and Clear also work after a cast ends",()=>{
  const game=new Playground();
  for (let i=0;i<MAX_SPELL_MARKS+3;i++) game.cast("red","gust",100+i,150);
  for (let i=0;i<SPELLS.gust.duration;i++) game.advance();
  const marks=game.world.marks;
  assert.equal(marks.length,MAX_SPELL_MARKS);
  assert.equal(marks[0].id,4);
  game.undo();
  assert.deepEqual(game.world.marks,marks.slice(0,-1));
  game.clear();
  assert.equal(game.world.marks,undefined);
  assert.equal(game.world.tick,0);
});
