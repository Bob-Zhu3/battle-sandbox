import assert from "node:assert/strict";
import test from "node:test";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";
import { characterPose, HIT_FLASH_TICKS, phoenixFlight } from "../src/character-pose.ts";
import { afflict } from "../src/conditions.ts";
import { battleFromDeployment, overTheShoulder } from "../src/deployment.ts";
import { battleOutcome, createBattle, stepBattle } from "../src/simulation.ts";

function poseOf(battle, unit) {
  return characterPose(unit, battle.units.find(other => other.id === unit.targetId), battle.tick);
}

test("damage flashes on impact, fades in seven ticks, and starts again on a poison pulse", () => {
  let world = createBattle([{ id: 1, kind: "warrior", team: "blue", x: 320, y: 160 }]);
  world.arrows.push({ team: "red", x: 300, y: 160, vx: 5, vy: 0, damage: 8, releasedTick: 0 });
  afflict(world.units[0], "poison", "red", 0);
  const changes = [];
  for (let tick = 1; tick <= 38; tick++) {
    const previous = world.units[0];
    world = stepBattle(world);
    const unit = world.units[0];
    const poseAt = time => characterPose(unit, undefined, time, unit.walkDistance, previous.lastHitTick);
    const flash = poseAt(tick).hitFlash;
    if (unit.hp < previous.hp) {
      changes.push(tick);
      assert.equal(flash, 1);
      assert.equal(poseAt(tick - .1).hitFlash, 0);
    } else if (unit.lastHitTick === null || tick - unit.lastHitTick >= HIT_FLASH_TICKS) {
      assert.equal(flash, 0);
    } else if (tick - unit.lastHitTick <= 2) {
      assert.equal(flash, 1);
    } else {
      assert.ok(flash > 0 && flash < poseAt(tick - 1).hitFlash);
    }
    const rejoined = JSON.parse(JSON.stringify(world));
    assert.equal(characterPose(rejoined.units[0], undefined, rejoined.tick).hitFlash, flash);
  }
  assert.deepEqual(changes, [2, 30]);
  const unit = { ...world.units[0], lastHitTick: 33 };
  assert.ok(characterPose(unit, undefined, 32.75, unit.walkDistance, 30).hitFlash > .8);
  assert.equal(characterPose(unit, undefined, 33, unit.walkDistance, 30).hitFlash, 1);
});

test("a Phoenix glides between strokes, rakes on contact and opens its wings to climb away", () => {
  let world = createBattle([{ id: 1, kind: "phoenix", team: "red", x: 300, y: 140 },
    { id: 2, kind: "post", team: "blue", x: 390, y: 140 }]);
  world.units[1].nextAttackTick = 1000;
  const bird = world.units[0];
  const flight = (u, time) => phoenixFlight(u, characterPose(u, world.units[1], time), time);
  const atRest = Array.from({length: 55}, (_, i) => flight(bird, i));
  assert.ok(Math.max(...atRest.map(p => p.wing)) - Math.min(...atRest.map(p => p.wing)) > 1.5);
  assert.deepEqual(flight(bird, 17), flight(JSON.parse(JSON.stringify(bird)), 17));
  let contact, climbed;
  for (let i = 0; i < 75; i++) {
    const previous = world;
    world = stepBattle(world);
    const pose = flight(world.units[0], world.tick);
    if (contact === undefined) {
      if (world.units[1].hp === previous.units[1].hp) assert.equal(pose.talons, 0);
      else { contact = world.tick; assert.equal(pose.talons, 1); }
    } else if (world.tick === contact + 11) {
      assert.equal(pose.talons, 0);
      assert.ok(pose.pullUp > .95);
      climbed = true;
    }
  }
  assert.ok(climbed);
});

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
      assert.equal(target.hp, defs.archer.maxHp);
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
      assert.equal(target.hp, defs.archer.maxHp - 8);
    }
    assert.equal(warrior.hp, defs.warrior.maxHp);
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
