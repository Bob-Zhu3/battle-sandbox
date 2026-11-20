import assert from "node:assert/strict";
import test from "node:test";
import { Playground } from "../src/playground.ts";
import { characterPose } from "../src/character-pose.ts";

const troop = (x, y, archer = false) => ({ type: archer ? "place-archers" : "place-warriors", positions: [{ x, y }] });
function ticks(field, n) { for (let i = 0; i < n; i++) field.advance(); }

test("allies idle anywhere; enemies can join a fight and another fight can follow on the same field", () => {
  const field = new Playground();
  field.place("red", troop(740, 110));
  ticks(field, 35);
  const idle = field.world.units[0];
  assert.deepEqual([idle.x,idle.y,idle.hp,idle.targetId], [740,110,30,null]);
  const a = characterPose(idle, undefined, field.world.tick);
  ticks(field, 12);
  assert.notEqual(characterPose(idle, undefined, field.world.tick).breath, a.breath);
  field.place("blue", troop(765, 110));
  field.advance();
  assert.deepEqual(field.world.units.map(u => u.hp), [20,20]);
  const current = field.world, time = current.tick;
  field.place("amber", troop(35, 205, true));
  assert.equal(field.world.tick, time);
  assert.deepEqual(field.world.units.slice(0,2), current.units);
  ticks(field, 130);
  assert.deepEqual(field.world.units.map(u => u.team), ["amber"]);
  const survivor = field.world.units[0];
  field.place("violet", troop(survivor.x + 35, survivor.y));
  field.advance();
  assert.equal(field.world.units.at(-1).targetId, survivor.id);
  assert.equal(field.world.units[0].hp, 10);
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
