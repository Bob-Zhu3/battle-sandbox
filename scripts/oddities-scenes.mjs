import assert from "node:assert/strict";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";

export async function playOddities({page,place,show,clear,hp}) {
  const roster=team=>page.locator("#"+team+"-score").getAttribute("aria-description");
  await place("Red","Frost Queen",335,132);await place("Red","Phoenix",333,202);
  await place("Blue","Watchpost",624,130);await place("Blue","Watchpost",625,200);
  await show(1450,"Frost crystals and sparks follow the actual path.");
  await clear();

  await place("Blue","Watchpost",545,167);await place("Red","Miner",512,165);
  await page.clock.runFor(680);
  await show(1350,"The Miner surfaces at the little red flag.");
  assert.ok((await hp("blue"))<defs.post.maxHp);await clear();

  await place("Red","Witch",358,166);await place("Blue","Shieldbearer",443,166);await place("Blue","Watchpost",494,169);
  await show(500,"The Witch turns a Shieldbearer into a pig.");
  assert.match(await roster("red"),/Hex Pig 1/);
  await show(1100,"The pig rushes its old Watchpost.");
  await page.clock.runFor(1000);
  await show(1000,"The pig keeps fighting on the Witch's side.");
  assert.match(await roster("red"),/Hex Pig 1/);
  assert.doesNotMatch(await roster("blue"),/Shieldbearer/);await clear();

  await place("Red","Zombie",370,160);await place("Blue","Archer",443,164);await place("Blue","Engineer",485,179);
  await show(950,"A bite turns the Archer on the spot.");
  assert.match(await roster("red"),/Zombie 2/);
  await show(1100,"The turned Archer can spread the bite.");
  assert.match(await roster("red"),/Zombie 3/);await clear();

  await place("Red","Clown",404,165);await place("Blue","Watchpost",510,167);
  await show(800,"The glass bottle shatters and leaves a poison cloud.");
  await place("Blue","Lancer",510,174);
  await show(550,"A late arrival picks up the poison.");
  await place("Blue","Gust",506,168);
  await show(450,"A defending Gust clears the cloud.");await clear();

  await place("Red","Reaper",424,171);await place("Blue","Warrior",454,171);
  await show(2100,"The Reaper and Warrior trade blows.");
  await show(450,"The last scythe stroke brings a soul to the lantern.");
  assert.equal(await hp("blue"),0);assert.equal(await hp("red"),defs.reaper.maxHp - 5*defs.warrior.damage + defs.reaper.harvestHp);
  await show(450,"The last scythe stroke brings a soul to the lantern.",true);
}
