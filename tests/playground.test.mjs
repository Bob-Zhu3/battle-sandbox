import assert from "node:assert/strict";
import test from "node:test";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";
import { Playground } from "../src/playground.ts";
import { characterPose } from "../src/character-pose.ts";

const troop = (x, y, archer = false) => ({ type: archer ? "place-archers" : "place-warriors", positions: [{ x, y }] });
function ticks(field, n) { for (let i = 0; i < n; i++) field.advance(); }

test("pausing preserves an airborne arrow and queued spell until exactly the next tick on resume", () => {
  const control = new Playground(), paused = new Playground();
  for (const field of [control, paused]) {
    field.place("red", troop(300, 180, true));
    field.place("blue", troop(400, 180));
    ticks(field, 3);
    assert.equal(field.world.arrows.length, 1);
  }
  paused.paused = true;
  for (const field of [control, paused]) {
    field.cast("red", "meteor", 400, 180);
    field.place("red", troop(240, 180));
  }
  const stopped = structuredClone(paused.world);
  ticks(paused, 600);
  assert.deepEqual(structuredClone(paused.world), stopped);
  paused.paused = false;
  ticks(control, 125);
  ticks(paused, 125);
  assert.deepEqual(paused.world, control.world);
});

test("allies idle anywhere; enemies can join a fight and another fight can follow on the same field", () => {
  const field = new Playground();
  field.place("red", troop(740, 110));
  ticks(field, 35);
  const idle = field.world.units[0];
  assert.deepEqual([idle.x,idle.y,idle.hp,idle.targetId], [740,110,defs.warrior.maxHp,null]);
  const a = characterPose(idle, undefined, field.world.tick);
  ticks(field, 12);
  assert.notEqual(characterPose(idle, undefined, field.world.tick).breath, a.breath);
  field.place("blue", troop(765, 110));
  field.advance();
  assert.deepEqual(field.world.units.map(u => u.hp), [30,30]);
  const current = field.world, time = current.tick;
  field.place("amber", troop(35, 205, true));
  assert.equal(field.world.tick, time);
  assert.deepEqual(field.world.units.slice(0,2), current.units);
  ticks(field, 145);
  assert.deepEqual(field.world.units.map(u => u.team), ["amber"]);
  const survivor = field.world.units[0];
  field.place("violet", troop(survivor.x + 35, survivor.y));
  field.advance();
  assert.equal(field.world.units.at(-1).targetId, survivor.id);
  assert.equal(field.world.units[0].hp, defs.archer.maxHp - 10);
});

test("a live drag is one removable squad and the solo brush can exceed a match budget", () => {
  const field = new Playground();
  field.place("blue", troop(100, 150));
  field.place("red", troop(600, 180));
  field.place("red", { type: "place-warriors", positions: [624,648,672,696].map(x => ({x,y:180})) }, true);
  assert.deepEqual(field.world.units.map(u => u.id), [1,2,3,4,5,6]);
  field.undo();
  assert.deepEqual(field.world.units.map(u => u.id), [1]);
  for (let i=0; i<20; i++) field.place("red", troop(510+i*15,250));
  assert.equal(field.world.units.length, 21);
  field.clear();
  assert.equal(field.world.units.length, 0);
  assert.equal(field.canUndo, false);
});
