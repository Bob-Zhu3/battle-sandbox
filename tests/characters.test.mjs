import assert from "node:assert/strict";
import test from "node:test";
import { characterPose } from "../src/character-pose.ts";
import { battleFromDeployment, overTheShoulder } from "../src/deployment.ts";
import { battleOutcome, createBattle, stepBattle } from "../src/simulation.ts";

function poseOf(battle, unit) {
  return characterPose(unit, battle.units.find(other => other.id === unit.targetId), battle.tick);
}

function shootingLane(coverY) {
  const battle = createBattle([
    { id: 1, team: "red", kind: "archer", x: 200, y: 150 },
    { id: 2, team: "red", kind: "warrior", x: 253, y: coverY },
    { id: 3, team: "blue", kind: "archer", x: 305, y: 150 },
  ]);
  battle.units[1].nextAttackTick = battle.units[2].nextAttackTick = 1000;
  return battle;
}

test("a covered Archer releases, peers over its screen, then its Warrior ducks before the real impact", () => {
  let battle = shootingLane(150);
  let duck, impact;
  for (let tick = 1; tick <= 35; tick++) {
    battle = stepBattle(battle);
    const [archer, warrior, target] = battle.units;
    if (tick === 1) {
      assert.equal(archer.lastAttackTick, tick);
      assert.equal(archer.lastAttentionTick, tick);
      assert.equal(poseOf(battle, archer).loose, 1);
      assert.equal(warrior.lastAttentionTick, null);
      assert.equal(poseOf(battle, target).hurt, 0);
      assert.equal(target.hp, 20);
    }
    if (tick === 10) assert.equal(poseOf(battle, archer).peek, 1);
    if (warrior.lastAttentionTick === tick) {
      assert.equal(duck, undefined, "one passing shaft cued the shoulder twice");
      duck = tick;
      assert.ok(battle.arrows.some(a => a.team === warrior.team && a.x < warrior.x));
    }
    if (target.lastHitTick === tick) {
      assert.equal(impact, undefined);
      impact = tick;
      assert.equal(poseOf(battle, target).hurt, 1);
      assert.equal(target.hp, 12);
    }
    assert.equal(warrior.hp, 30);
  }
  assert.ok(duck > 1 && impact > duck);
});

test("a Warrior outside the firing lane prompts neither a peek nor a duck", () => {
  let battle = shootingLane(235);
  for (let tick = 1; tick <= 30; tick++) {
    battle = stepBattle(battle);
    const [archer, warrior] = battle.units;
    assert.equal(archer.lastAttackTick, 1);
    assert.equal(poseOf(battle, archer).peek, 0);
    assert.equal(poseOf(battle, warrior).duck, 0);
  }
});

test("a released shot holds the Archer's gaze if its combat target changes sides", () => {
  let battle = shootingLane(150);
  for (let i = 0; i < 8; i++) battle = stepBattle(battle);
  const watcher = battle.units[0];
  const newcomer = createBattle([{ id: 12, team: "blue", x: 181, y: 150 }]).units[0];
  battle.units.push(newcomer);
  battle = stepBattle(battle);
  const archer = battle.units[0];
  assert.equal(archer.targetId, newcomer.id);
  assert.ok(archer.aimX < 0);
  assert.equal(poseOf(battle, archer).side, 1);
  assert.equal(watcher.targetId, 3, "advancing preserves the previous unit");
});

test("a fresh network snapshot and a full replay reproduce the showcase poses on every tick", () => {
  const play = () => battleFromDeployment(overTheShoulder());
  let original = play(), replay = play();
  const reactions = new Set();
  do {
    original = stepBattle(original);
    replay = stepBattle(replay);
    const joined = JSON.parse(JSON.stringify(original));
    const expected = original.units.map(u => poseOf(original, u));
    assert.deepEqual(joined.units.map(u => poseOf(joined, u)), expected);
    assert.deepEqual(replay.units.map(u => poseOf(replay, u)), expected);
    for (const unit of original.units) {
      if (unit.lastAttentionTick === original.tick) reactions.add(unit.kind);
    }
  } while (battleOutcome(original) === null);
  assert.deepEqual([...reactions].sort(), ["archer", "warrior"]);
  assert.deepEqual(replay, original);
});
